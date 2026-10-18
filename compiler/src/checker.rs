//! M2 static type inference, scoped name resolution and typed AST construction.
//! Program checking is conservative: unknown types and ambiguous `+` are errors,
//! not runtime guesses. Imported symbols have the exact contracts from their lockfile.
use std::collections::{HashMap};
use crate::{Diagnostic,ast::{Program,Stmt,StmtKind,Expr,ExprKind,UnaryOp,BinaryOp},lexer::Span,packages::{PackageRegistry,OperationSig}};

#[derive(Clone,Debug,PartialEq,Eq)]
pub enum Type {
    Number, String, Bool, Unit,
    Function(Vec<Type>,Box<Type>),
    Sequence(Box<Type>),
    Record(Vec<(String,Type)>), // Sorted exact structural fields, no dynamic property lookup
    Generic(String), // Rigid ∀ binder, not a mutable inference variable
    Variable(u32),
    BuiltinPrint,
}
impl Type {
    pub(crate) fn from_bound_name(name:&str,bound:&[String],span:Span)->Result<Type,Diagnostic>{
        if let Some(inner)=name.strip_prefix('⟦').and_then(|s|s.strip_suffix('⟧')){
            return Ok(Type::Sequence(Box::new(Self::from_bound_name(inner,bound,span)?)));
        }
        if let Some(inner)=name.strip_prefix('⦃').and_then(|s|s.strip_suffix('⦄')){
            // Split commas at depth zero. Records may nest inside sequences or other records.
            let mut fields=Vec::new();
            if !inner.is_empty(){
                let mut pieces=Vec::new();let mut start=0usize;let mut open=Vec::new();
                for (offset,c) in inner.char_indices(){
                    match c {
                        '⦃'|'⟦'=>open.push(c),
                        '⦄'=>if open.pop()!=Some('⦃'){return Err(Diagnostic::new("TYPE","Unbalanced record annotation".into(),span));},
                        '⟧'=>if open.pop()!=Some('⟦'){return Err(Diagnostic::new("TYPE","Unbalanced sequence annotation".into(),span));},
                        ',' if open.is_empty()=>{pieces.push(&inner[start..offset]);start=offset+1;},
                        _=>{}
                    }
                }
                if !open.is_empty(){return Err(Diagnostic::new("TYPE","Unclosed record annotation".into(),span));}
                pieces.push(&inner[start..]);
                if pieces.len()>64{return Err(Diagnostic::new("TYPE","Record exceeds 64 fields".into(),span));}
                for piece in pieces {
                    let (key,value)=piece.split_once(':').ok_or_else(||Diagnostic::new("TYPE","Record field requires a type".into(),span))?;
                    let first=key.as_bytes().first().copied();
                    if !matches!(first,Some(b'a'..=b'z'|b'A'..=b'Z'|b'_')) ||
                       !key.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'_') ||
                       fields.iter().any(|(n,_)|n==key){
                        return Err(Diagnostic::new("TYPE",format!("Invalid or duplicate record field {key}"),span));
                    }
                    fields.push((key.to_string(),Self::from_bound_name(value,bound,span)?));
                }
                fields.sort_by(|a,b|a.0.cmp(&b.0));
            }
            return Ok(Type::Record(fields));
        }
        if bound.iter().any(|item|item==name){return Ok(Type::Generic(name.to_string()));}
        match name {
            "Number"=>Ok(Self::Number),"String"=>Ok(Self::String),"Bool"=>Ok(Self::Bool),"Unit"=>Ok(Self::Unit),
            _=>Err(Diagnostic::new("TYPE",format!("Unknown type {name}"),span))
        }
    }
    pub(crate) fn from_name(name:&str,span:Span)->Result<Type,Diagnostic>{
        Self::from_bound_name(name,&[],span)
    }
}

#[derive(Clone,Debug,PartialEq)]
pub struct TypedProgram { pub statements: Vec<TypedStmt> }
#[derive(Clone,Debug,PartialEq)]
pub struct TypedStmt { pub kind: TypedStmtKind, pub span: Span }
#[derive(Clone,Debug,PartialEq)]
pub enum TypedStmtKind {
    Use { package:String, alias:String },
    Import { source:String, alias:String },
    Export { declaration:Box<TypedStmt> },
    Let { name:String, value:TypedExpr },
    Assign { name:String, value:TypedExpr },
    Function { name:String, parameters:Vec<(String,Type)>, returns:Type, body:Vec<TypedStmt> },
    Return(TypedExpr),
    If { condition:TypedExpr, then_body:Vec<TypedStmt>, else_body:Option<Vec<TypedStmt>> },
    While { condition:TypedExpr, body:Vec<TypedStmt> },
    Expression(TypedExpr),
}
#[derive(Clone,Debug,PartialEq)]
pub struct TypedExpr { pub kind:TypedExprKind,pub ty:Type,pub span:Span }
#[derive(Clone,Debug,PartialEq)]
pub enum TypedExprKind {
    Number(String),String(String),Bool(bool),Identifier(String),
    OperationRef { id:String },
    Unary { op:UnaryOp,operand:Box<TypedExpr> },
    Binary { op:BinaryOp,left:Box<TypedExpr>,right:Box<TypedExpr> },
    Choice { condition:Box<TypedExpr>,when_true:Box<TypedExpr>,when_false:Box<TypedExpr> },
    Call { callee:Box<TypedExpr>,arguments:Vec<TypedExpr> },
    Sequence(Vec<TypedExpr>),
    Record(Vec<(String,TypedExpr)>),
    Field { record:Box<TypedExpr>,name:String },
    RecordUpdate { record:Box<TypedExpr>,name:String,value:Box<TypedExpr> },
    JsonRead { schema:Type,value:Box<TypedExpr> },
    JsonWrite { value:Box<TypedExpr>,schema:Type },
    TextScalars(Box<TypedExpr>),
    TextWords(Box<TypedExpr>),
    Histogram(Box<TypedExpr>),
    FileRead(Box<TypedExpr>),
    FileWrite { filename:Box<TypedExpr>, content:Box<TypedExpr> },
    HttpGet(Box<TypedExpr>),
    Sleep(Box<TypedExpr>),
    StdinText,
    ArithEval(Box<TypedExpr>),
    CsvTyped {schema:Type,value:Box<TypedExpr>},
    Index { sequence:Box<TypedExpr>,index:Box<TypedExpr> },
    Length(Box<TypedExpr>),
    Sum(Box<TypedExpr>),
    Lambda { parameter:String, body:Box<TypedExpr> },
    Section { op:BinaryOp, right:Box<TypedExpr> },
}

#[derive(Clone)]
struct Binding { ty:Type,assignable:bool }
struct ActiveFunction { expected:Type,saw_return:bool,generics:Vec<String> }

pub fn check(program:&Program, registry:&PackageRegistry, allow_print:bool)->Result<TypedProgram,Diagnostic>{
    let mut checker=Checker{
        scopes:vec![HashMap::new()],substitutions:HashMap::new(),fresh:0,
        imported:HashMap::new(),glyphs:HashMap::new(),active_function:None,
        pending_add:Vec::new(),pending_equal:Vec::new(),lambda_depth:0,allow_print
    };
    if allow_print {
        checker.declare("print",Type::BuiltinPrint,false,Span::new(1,1))?;
    }
    checker.imports(program,registry)?;
    checker.predeclare(&program.statements)?;
    let mut statements=Vec::new();
    for stmt in &program.statements { statements.push(checker.statement(stmt)?); }
    checker.verify_constraints()?;
    let mut checked=TypedProgram{statements};
    checker.finalize_program(&mut checked)?;
    Ok(checked)
}

struct Checker {
    scopes:Vec<HashMap<String,Binding>>,
    substitutions:HashMap<u32,Type>,fresh:u32,
    imported:HashMap<String,Vec<OperationSig>>,
    glyphs:HashMap<String,Vec<OperationSig>>,
    active_function:Option<ActiveFunction>,
    pending_add:Vec<(Type,Span)>,
    pending_equal:Vec<(Type,Span)>,
    allow_print:bool,
    lambda_depth:usize,
}
impl Checker {
    fn fresh(&mut self)->Type {let n=self.fresh;self.fresh+=1;Type::Variable(n)}
    fn resolved(&self,ty:&Type)->Type {
        match ty {
            Type::Variable(id)=>match self.substitutions.get(id){Some(x)=>self.resolved(x),None=>ty.clone()},
            Type::Function(params,ret)=>Type::Function(params.iter().map(|x|self.resolved(x)).collect(),Box::new(self.resolved(ret))),
            Type::Sequence(item)=>Type::Sequence(Box::new(self.resolved(item))),
            Type::Record(fields)=>Type::Record(fields.iter().map(|(key,ty)|(key.clone(),self.resolved(ty))).collect()),
            _=>ty.clone()
        }
    }
    fn occurs(&self,id:u32,ty:&Type)->bool {
        match self.resolved(ty){Type::Variable(n)=>id==n,
            Type::Function(a,r)=>a.iter().any(|t|self.occurs(id,t))||self.occurs(id,&r),
            Type::Sequence(item)=>self.occurs(id,&item),
            Type::Record(fields)=>fields.iter().any(|(_,ty)|self.occurs(id,ty)),_=>false}
    }
    fn unify(&mut self,left:&Type,right:&Type,span:Span,reason:&str)->Result<Type,Diagnostic>{
        let a=self.resolved(left);let b=self.resolved(right);
        if a==b {return Ok(a);}
        match (&a,&b){
            (Type::Variable(id),other)|(other,Type::Variable(id))=>{
                if self.occurs(*id,other){return Err(Diagnostic::new("TYPE",format!("{reason}: recursive type"),span));}
                self.substitutions.insert(*id,other.clone()); Ok(other.clone())
            }
            (Type::Sequence(ea),Type::Sequence(eb))=>{
                Ok(Type::Sequence(Box::new(self.unify(ea,eb,span,reason)?)))
            }
            (Type::Record(fa),Type::Record(fb)) if fa.len()==fb.len() &&
                fa.iter().zip(fb).all(|((a,_),(b,_))|a==b)=>{
                let mut fields=Vec::with_capacity(fa.len());
                for ((key,left),(_,right)) in fa.iter().zip(fb){
                    fields.push((key.clone(),self.unify(left,right,span,reason)?));
                }
                Ok(Type::Record(fields))
            }
            (Type::Function(pa,ra),Type::Function(pb,rb)) if pa.len()==pb.len()=>{
                let mut params=Vec::new();
                for (x,y) in pa.iter().zip(pb) { params.push(self.unify(x,y,span,reason)?); }
                let result=self.unify(ra,rb,span,reason)?;
                Ok(Type::Function(params,Box::new(result)))
            }
            _=>Err(Diagnostic::new("TYPE",format!("{reason}: expected {a:?}, got {b:?}"),span))
        }
    }
    fn push(&mut self){self.scopes.push(HashMap::new());}
    fn pop(&mut self){self.scopes.pop();}
    fn declare(&mut self,name:&str,ty:Type,assignable:bool,span:Span)->Result<(),Diagnostic>{
        let scope=self.scopes.last_mut().expect("root scope exists");
        if scope.contains_key(name){return Err(Diagnostic::new("TYPE",format!("Duplicate declaration {name}"),span));}
        scope.insert(name.into(),Binding{ty,assignable});Ok(())
    }
    fn lookup(&self,name:&str,span:Span)->Result<Binding,Diagnostic>{
        self.scopes.iter().rev().find_map(|s|s.get(name)).cloned()
            .ok_or_else(||Diagnostic::new("TYPE",format!("Unknown identifier {name}"),span))
    }
    fn imports(&mut self,program:&Program,registry:&PackageRegistry)->Result<(),Diagnostic>{
        for stmt in &program.statements {
            let StmtKind::Use{package,alias}=&stmt.kind else {continue};
            let Some(def)=registry.packages.get(package) else {
                return Err(Diagnostic::new("IMPORT",format!("Package {package} is not present in the verified lockfile"),stmt.span));
            };
            if !package.starts_with("local:") && !valid_package_spec(package) {
                return Err(Diagnostic::new("IMPORT",format!("Invalid exact-version package specifier {package}"),stmt.span));
            }
            if self.imported.contains_key(alias) || (alias=="print" && self.allow_print) {
                return Err(Diagnostic::new("IMPORT",format!("Duplicate or reserved import alias {alias}"),stmt.span));
            }
            self.imported.insert(alias.clone(),def.operations.clone());
            for op in &def.operations {
                let list=self.glyphs.entry(op.glyph.clone()).or_default();
                if !list.iter().any(|e|e.id==op.id){list.push(op.clone());}
            }
        }
        Ok(())
    }
    fn predeclare(&mut self,statements:&[Stmt])->Result<(),Diagnostic>{
        for outer in statements {
            // Export wraps a declaration but does not change when names enter scope.
            // Predeclare exported functions as well, so recursion and forward calls
            // work identically for exported and ordinary H-Code functions.
            let stmt=match &outer.kind {
                StmtKind::Export{declaration}=>declaration.as_ref(),
                _=>outer
            };
            let StmtKind::Function{name,type_parameters,parameters,returns,..}=&stmt.kind else {continue};
            // Quantification currently has source-verification semantics only
            // inside locked pure packages. Public generic invocation is
            // independently fresh-instantiated by ExprKind::Operation.
            if !type_parameters.is_empty() && self.allow_print {
                return Err(Diagnostic::new("TYPE","∀ declarations are only available in verified package source".into(),stmt.span));
            }
            if self.scopes.len()==1 && self.imported.contains_key(name) {
                return Err(Diagnostic::new("TYPE",format!("Function {name} conflicts with package alias"),stmt.span));
            }
            let mut args=Vec::new();
            for param in parameters {
                args.push(match &param.annotation {
                    Some(a)=>Type::from_bound_name(a,type_parameters,param.span)?,
                    None if !type_parameters.is_empty()=>return Err(Diagnostic::new("TYPE","∀ requires explicitly annotated parameters".into(),param.span)),
                    None=>self.fresh()
                });
            }
            let result=match returns{
                Some(t)=>Type::from_bound_name(t,type_parameters,stmt.span)?,
                None if !type_parameters.is_empty()=>return Err(Diagnostic::new("TYPE","∀ requires explicit return type".into(),stmt.span)),
                None=>self.fresh()
            };
            self.declare(name,Type::Function(args,Box::new(result)),false,stmt.span)?;
        }
        Ok(())
    }
    fn statement(&mut self,node:&Stmt)->Result<TypedStmt,Diagnostic>{
        let kind=match &node.kind {
            StmtKind::Use{package,alias}=>TypedStmtKind::Use{package:package.clone(),alias:alias.clone()},
            StmtKind::Import{source,alias}=>return Err(Diagnostic::new("IMPORT",format!("Local module {source} as {alias} requires M4 module resolution"),node.span)),
            StmtKind::Export{declaration}=>{
                let typed=self.statement(declaration)?;
                TypedStmtKind::Export{declaration:Box::new(typed)}
            },
            StmtKind::Let{name,annotation,value}=>{
                if self.scopes.len()==1 && self.imported.contains_key(name) {
                    return Err(Diagnostic::new("TYPE",format!("Declaration {name} conflicts with package alias"),node.span));
                }
                let expr=self.expression(value)?;
                let binding_ty=if let Some(ty)=annotation {
                    let bound=self.active_function.as_ref().map(|f|f.generics.as_slice()).unwrap_or(&[]);
                    let expected=Type::from_bound_name(ty,bound,node.span)?;
                    self.unify(&expected,&expr.ty,node.span,"Declaration type mismatch")?;
                    expected
                } else {expr.ty.clone()};
                self.declare(name,binding_ty,true,node.span)?;
                TypedStmtKind::Let{name:name.clone(),value:expr}
            }
            StmtKind::Assign{name,value}=>{
                let binding=self.lookup(name,node.span)?;
                if !binding.assignable {return Err(Diagnostic::new("TYPE",format!("Cannot assign to function or builtin {name}"),node.span));}
                let expr=self.expression(value)?;
                self.unify(&binding.ty,&expr.ty,node.span,"Assignment type mismatch")?;
                TypedStmtKind::Assign{name:name.clone(),value:expr}
            }
            StmtKind::Function{name,type_parameters,parameters,body,..}=>{
                let binding=self.lookup(name,node.span)?;
                let Type::Function(params,ret)=binding.ty else {unreachable!("predeclared function")};
                self.push();
                for (param,ty) in parameters.iter().zip(params.iter()) {
                    self.declare(&param.name,ty.clone(),true,param.span)?;
                }
                let previous=self.active_function.take();
                self.active_function=Some(ActiveFunction{expected:(*ret).clone(),saw_return:false,generics:type_parameters.clone()});
                let (typed_body,always_returns)=self.body(body)?;
                let current=self.active_function.take().expect("inside function");
                self.active_function=previous;
                if !current.saw_return {
                    self.unify(&ret,&Type::Unit,node.span,"Function without return must return Unit")?;
                } else if !always_returns {
                    let inferred=self.resolved(&ret);
                    if inferred!=Type::Unit {
                        return Err(Diagnostic::new("RETURN",format!("Function {name} does not return on every execution path"),node.span));
                    }
                }
                let typed_params=parameters.iter().zip(params.iter()).map(|(p,t)|(p.name.clone(),t.clone())).collect();
                TypedStmtKind::Function{name:name.clone(),parameters:typed_params,returns:(*ret).clone(),body:typed_body}
            }
            StmtKind::Return(value)=>{
                let Some(expected)=self.active_function.as_ref().map(|a|a.expected.clone()) else {
                    return Err(Diagnostic::new("RETURN","return is only valid inside a function".into(),node.span));
                };
                let expr=self.expression(value)?;
                self.unify(&expected,&expr.ty,node.span,"Return type mismatch")?;
                self.active_function.as_mut().expect("inside function").saw_return=true;
                TypedStmtKind::Return(expr)
            }
            StmtKind::If{condition,then_body,else_body}=>{
                let test=self.expression(condition)?;
                self.unify(&Type::Bool,&test.ty,condition.span,"if condition must be Bool")?;
                let (then_checked,_)=self.scoped_body(then_body)?;
                let else_checked=match else_body {Some(b)=>Some(self.scoped_body(b)?.0),None=>None};
                TypedStmtKind::If{condition:test,then_body:then_checked,else_body:else_checked}
            }
            StmtKind::While{condition,body}=>{
                let test=self.expression(condition)?;
                self.unify(&Type::Bool,&test.ty,condition.span,"while condition must be Bool")?;
                let (typed_body,_)=self.scoped_body(body)?;
                TypedStmtKind::While{condition:test,body:typed_body}
            }
            StmtKind::Expression(value)=>TypedStmtKind::Expression(self.expression(value)?),
        };
        Ok(TypedStmt{kind,span:node.span})
    }
    fn scoped_body(&mut self,body:&[Stmt])->Result<(Vec<TypedStmt>,bool),Diagnostic>{
        self.push();
        let result=self.body(body);
        self.pop();
        result
    }
    fn body(&mut self,body:&[Stmt])->Result<(Vec<TypedStmt>,bool),Diagnostic>{
        self.predeclare(body)?;
        let mut checked=Vec::new();let mut always_returns=false;
        for stmt in body {
            checked.push(self.statement(stmt)?);
            if !always_returns {always_returns=statement_returns(stmt);}
        }
        Ok((checked,always_returns))
    }
    fn operation(&self,alias:&Option<String>,member:&str,is_glyph:bool,span:Span)->Result<OperationSig,Diagnostic>{
        match alias {
            Some(name)=>{
                let Some(operations)=self.imported.get(name) else {return Err(Diagnostic::new("IMPORT",format!("Unknown package alias {name}"),span));};
                operations.iter().find(|op|if is_glyph {op.glyph==member}else{op.name==member})
                    .cloned().ok_or_else(||Diagnostic::new("IMPORT",format!("Unknown operation {name}::{member}"),span))
            }
            None=>{
                let options=self.glyphs.get(member).map(Vec::as_slice).unwrap_or(&[]);
                match options {
                    []=>Err(Diagnostic::new("IMPORT",format!("Unbound symbol {member}; import its package first"),span)),
                    [one]=>Ok(one.clone()),
                    _=>Err(Diagnostic::new("IMPORT",format!("Ambiguous symbol {member}; use packageAlias::operation"),span)),
                }
            }
        }
    }
    fn instantiate_type(ty:&Type,bound:&HashMap<String,Type>)->Type{
        match ty {
            Type::Generic(name)=>bound.get(name).cloned().unwrap_or_else(||ty.clone()),
            Type::Sequence(inner)=>Type::Sequence(Box::new(Self::instantiate_type(inner,bound))),
            Type::Record(fields)=>Type::Record(fields.iter().map(|(key,ty)|(key.clone(),Self::instantiate_type(ty,bound))).collect()),
            Type::Function(args,ret)=>Type::Function(args.iter().map(|t|Self::instantiate_type(t,bound)).collect(),Box::new(Self::instantiate_type(ret,bound))),
            _=>ty.clone()
        }
    }
    // JSON is a data boundary: never erase functions, ∀T, Unit or unknown types.
    fn valid_json_type(ty:&Type,depth:usize)->bool {
        if depth>32 {return false;}
        match ty {
            Type::Number|Type::String|Type::Bool=>true,
            Type::Sequence(value)=>Self::valid_json_type(value,depth+1),
            Type::Record(fields)=>fields.len()<=64 &&
                fields.iter().all(|(_,ty)|Self::valid_json_type(ty,depth+1)),
            _=>false
        }
    }
    // Contextual inference: when a sequence drives ⌕ or ⇢, infer its
    // element type BEFORE checking λ's body. Without this, λe:e·field
    // cannot access known record fields because e is still a type variable.
    // This is general bidirectional typing, not a cache-specific shortcut.
    fn sequence_lambda(&mut self, source:&Expr, element:Type)->Result<TypedExpr,Diagnostic>{
        let ExprKind::Lambda{parameter,body}=&source.kind else {
            unreachable!("sequence_lambda requires an inline lambda");
        };
        self.push();
        self.declare(parameter,element.clone(),false,source.span)?;
        self.lambda_depth+=1;
        let inferred=self.expression(body);
        self.lambda_depth-=1;
        self.pop();
        let checked=inferred?;
        let return_type=checked.ty.clone();
        Ok(TypedExpr{kind:TypedExprKind::Lambda{
            parameter:parameter.clone(),body:Box::new(checked)
        },ty:Type::Function(vec![element],Box::new(return_type)),span:source.span})
    }
    fn expression(&mut self,expr:&Expr)->Result<TypedExpr,Diagnostic>{
        let (kind,ty)=match &expr.kind {
            ExprKind::JsonRead{schema,value}=>{
                let resolved=Type::from_name(schema,expr.span)?;
                if !Self::valid_json_type(&resolved,0){
                    return Err(Diagnostic::new("TYPE","⤓ schema must be a concrete JSON-compatible type with depth <=32".into(),expr.span));
                }
                let input=self.expression(value)?;
                self.unify(&Type::String,&input.ty,value.span,"⤓ expects JSON text of type String")?;
                (TypedExprKind::JsonRead{schema:resolved.clone(),value:Box::new(input)},resolved)
            }
            ExprKind::JsonWrite(value)=>{
                let checked=self.expression(value)?;
                let resolved=self.resolved(&checked.ty);
                if !Self::valid_json_type(&resolved,0){
                    return Err(Diagnostic::new("TYPE","⤒ expects statically typed JSON-compatible data".into(),expr.span));
                }
                (TypedExprKind::JsonWrite{value:Box::new(checked),schema:resolved},Type::String)
            }
            ExprKind::StdinText=>{
                if !self.allow_print {
                    return Err(Diagnostic::new("EFFECT","⌨ is an effectful stdin read; pure verified packages cannot access stdin".into(),expr.span));
                }
                (TypedExprKind::StdinText,Type::String)
            }
            ExprKind::ArithEval(value)=>{
                let typed=self.expression(value)?;
                self.unify(&Type::String,&typed.ty,value.span,"⩚ expects String arithmetic expression")?;
                (TypedExprKind::ArithEval(Box::new(typed)),Type::Number)
            }
            ExprKind::FileRead(value)=>{
                if !self.allow_print {
                    return Err(Diagnostic::new("EFFECT","⧄ requires an explicitly permitted file-read capability; pure package operations cannot read files".into(),expr.span));
                }
                let input=self.expression(value)?;
                self.unify(&Type::String,&input.ty,value.span,"⧄ requires String file name")?;
                (TypedExprKind::FileRead(Box::new(input)),Type::String)
            }
            ExprKind::FileWrite{filename,content}=>{
                // A write is only allowed in an explicit effectful program;
                // neither verified packages nor synchronous closures can write.
                if !self.allow_print || self.active_function.is_some() || self.lambda_depth>0 {
                    return Err(Diagnostic::new("EFFECT","⧅ file write is only available in effectful top-level program flow".into(),expr.span));
                }
                let file=self.expression(filename)?;
                self.unify(&Type::String,&file.ty,filename.span,"⧅ filename must be String")?;
                let value=self.expression(content)?;
                self.unify(&Type::String,&value.ty,content.span,"⧅ content must be String")?;
                (TypedExprKind::FileWrite{filename:Box::new(file),content:Box::new(value)},Type::Number)
            }
            ExprKind::HttpGet(value)=>{
                // HTTP is an application effect: pure packages, functions, and
                // non-async lambdas may not accidentally perform network I/O.
                if !self.allow_print || self.active_function.is_some() || self.lambda_depth>0 {
                    return Err(Diagnostic::new("EFFECT","⤋ HTTP GET is only available in effectful top-level program flow; pure packages and sync closures cannot use network I/O".into(),expr.span));
                }
                let input=self.expression(value)?;
                // One intrinsic ⤋ handles either a String URL or a typed
                // sequence of URLs. List input performs real parallel GETs;
                // the compiler never inserts a task-specific aggregator.
                let batch=matches!(self.resolved(&input.ty),Type::Sequence(_));
                if batch {
                    let expected=Type::Sequence(Box::new(Type::String));
                    self.unify(&expected,&input.ty,value.span,"⤋ batch expects ⟦String⟧ URLs")?;
                } else {
                    self.unify(&Type::String,&input.ty,value.span,"⤋ expects a String URL")?;
                }
                let structure=Type::Record(vec![
                    ("body".into(),Type::String),("ok".into(),Type::Bool),
                    ("retryAfter".into(),Type::Number),("status".into(),Type::Number)
                ]);
                let output=if batch {Type::Sequence(Box::new(structure))}else{structure};
                (TypedExprKind::HttpGet(Box::new(input)),output)
            }
            ExprKind::Sleep(value)=>{
                if !self.allow_print || self.active_function.is_some() || self.lambda_depth>0 {
                    return Err(Diagnostic::new("EFFECT","⌛ delay is only available in effectful top-level program flow; pure packages and sync closures cannot wait".into(),expr.span));
                }
                let input=self.expression(value)?;
                self.unify(&Type::Number,&input.ty,value.span,"⌛ expects Number milliseconds")?;
                (TypedExprKind::Sleep(Box::new(input)),Type::Unit)
            }
            ExprKind::CsvTyped{schema,value}=>{
                let ty=Type::from_name(schema,expr.span)?;
                let Type::Record(ref fields)=ty else {
                    return Err(Diagnostic::new("TYPE","⧇ requires an exact structural CSV record schema".into(),expr.span));
                };
                if fields.is_empty()||fields.len()>64||!fields.iter().all(|(_,v)|matches!(v,Type::String|Type::Number|Type::Bool)) {
                    return Err(Diagnostic::new("TYPE","⧇ supports 1..64 String/Number/Bool record fields only".into(),expr.span));
                }
                let input=self.expression(value)?;
                self.unify(&Type::String,&input.ty,value.span,"⧇ CSV input must be String")?;
                (TypedExprKind::CsvTyped{schema:ty.clone(),value:Box::new(input)},Type::Sequence(Box::new(ty)))
            }
            ExprKind::TextScalars(value)|ExprKind::TextWords(value)=>{
                let checked=self.expression(value)?;
                self.unify(&Type::String,&checked.ty,value.span,"Unicode text operation requires String")?;
                let typed=if matches!(&expr.kind,ExprKind::TextScalars(_)){
                    TypedExprKind::TextScalars(Box::new(checked))
                }else{
                    TypedExprKind::TextWords(Box::new(checked))
                };
                (typed,Type::Sequence(Box::new(Type::String)))
            }
            ExprKind::Histogram(value)=>{
                let checked=self.expression(value)?;
                let element=self.fresh();
                self.unify(&checked.ty,&Type::Sequence(Box::new(element.clone())),value.span,"⧉ requires a typed sequence")?;
                let concrete=self.resolved(&element);
                if !matches!(concrete,Type::String|Type::Number|Type::Bool){
                    return Err(Diagnostic::new("TYPE",
                        "⧉ requires a concrete Sequence<String|Number|Bool>; annotate an empty sequence".into(),expr.span));
                }
                let row=Type::Record(vec![
                    ("count".into(),Type::Number),("value".into(),concrete)
                ]);
                (TypedExprKind::Histogram(Box::new(checked)),Type::Sequence(Box::new(row)))
            }
            ExprKind::Record(fields)=>{
                let mut typed=Vec::with_capacity(fields.len());
                let mut structure=Vec::with_capacity(fields.len());
                for (key,value) in fields{
                    let value=self.expression(value)?;
                    structure.push((key.clone(),value.ty.clone()));
                    typed.push((key.clone(),value));
                }
                structure.sort_by(|a,b|a.0.cmp(&b.0));
                (TypedExprKind::Record(typed),Type::Record(structure))
            }
            ExprKind::Field{record,name}=>{
                let typed=self.expression(record)?;
                let resolved=self.resolved(&typed.ty);
                let Type::Record(fields)=resolved else{
                    return Err(Diagnostic::new("TYPE","Field access requires an explicitly typed record".into(),record.span));
                };
                let selected=fields.iter().find(|(key,_)|key==name).map(|(_,ty)|ty.clone())
                    .ok_or_else(||Diagnostic::new("TYPE",format!("Unknown record field {name}"),expr.span))?;
                (TypedExprKind::Field{record:Box::new(typed),name:name.clone()},selected)
            }
            ExprKind::RecordUpdate{record,name,value}=>{
                let checked_record=self.expression(record)?;
                let Type::Record(fields)=self.resolved(&checked_record.ty) else{
                    return Err(Diagnostic::new("TYPE","⊞ requires a typed record".into(),record.span));
                };
                let expected=fields.iter().find(|(key,_)|key==name).map(|(_,ty)|ty.clone())
                    .ok_or_else(||Diagnostic::new("TYPE",format!("Unknown record field {name}"),expr.span))?;
                let checked_value=self.expression(value)?;
                self.unify(&expected,&checked_value.ty,value.span,"Record update field type mismatch")?;
                (TypedExprKind::RecordUpdate{record:Box::new(checked_record),name:name.clone(),
                  value:Box::new(checked_value)},Type::Record(fields))
            }
            ExprKind::Sequence(items)=>{
                let element=self.fresh();
                let mut checked=Vec::with_capacity(items.len());
                for item in items {
                    let typed=self.expression(item)?;
                    self.unify(&element,&typed.ty,item.span,"Sequence elements must have matching types")?;
                    checked.push(typed);
                }
                (TypedExprKind::Sequence(checked),Type::Sequence(Box::new(element)))
            }
            ExprKind::Index{sequence,index}=>{
                let seq=self.expression(sequence)?;
                let offset=self.expression(index)?;
                self.unify(&Type::Number,&offset.ty,index.span,"Sequence index must be Number")?;
                if let ExprKind::Number(raw)=&index.kind {
                    if raw.parse::<f64>().map(|n|!n.is_finite()||n.fract()!=0.0).unwrap_or(true){
                        return Err(Diagnostic::new("TYPE","Sequence index must be an integer".into(),index.span));
                    }
                }
                let elem=self.fresh();
                self.unify(&seq.ty,&Type::Sequence(Box::new(elem.clone())),sequence.span,"Sequence index requires sequence")?;
                (TypedExprKind::Index{sequence:Box::new(seq),index:Box::new(offset)},elem)
            }
            ExprKind::Sum(value)=>{
                let seq=self.expression(value)?;
                self.unify(&seq.ty,&Type::Sequence(Box::new(Type::Number)),value.span,"∑ requires a numeric sequence")?;
                (TypedExprKind::Sum(Box::new(seq)),Type::Number)
            }
            ExprKind::Length(value)=>{
                let seq=self.expression(value)?;
                let elem=self.fresh();
                self.unify(&seq.ty,&Type::Sequence(Box::new(elem)),value.span,"⌗ requires sequence")?;
                (TypedExprKind::Length(Box::new(seq)),Type::Number)
            }
            ExprKind::Section{op,right}=>{
                let arg=self.expression(right)?;
                let (parameter,returned)=match op {
                    BinaryOp::Add=>{
                        // Reject concretely invalid RHS types at the site of
                        // (+value). Delaying all checks to verify_constraints()
                        // can otherwise mask a genuine + type error behind an
                        // unrelated call-argument mismatch at use sites.
                        let rhs=self.resolved(&arg.ty);
                        if !matches!(rhs,Type::Number|Type::String|Type::Variable(_)) {
                            return Err(Diagnostic::new("TYPE",format!("+ requires Number or String, got {rhs:?}"),right.span));
                        }
                        self.pending_add.push((arg.ty.clone(),expr.span));
                        (arg.ty.clone(),arg.ty.clone())
                    }
                    BinaryOp::Multiply|BinaryOp::Divide|BinaryOp::Modulo=>{
                        self.unify(&Type::Number,&arg.ty,right.span,"Operator section requires Number")?;
                        (Type::Number,Type::Number)
                    }
                    BinaryOp::Less|BinaryOp::Greater|BinaryOp::LessEqual|BinaryOp::GreaterEqual=>{
                        self.unify(&Type::Number,&arg.ty,right.span,"Operator section requires Number")?;
                        (Type::Number,Type::Bool)
                    }
                    BinaryOp::Equal|BinaryOp::NotEqual=>{
                        self.pending_equal.push((arg.ty.clone(),expr.span));
                        (arg.ty.clone(),Type::Bool)
                    }
                    _=>return Err(Diagnostic::new("TYPE","Unsupported operator section".into(),expr.span))
                };
                let ty=Type::Function(vec![parameter],Box::new(returned));
                (TypedExprKind::Section{op:*op,right:Box::new(arg)},ty)
            }
            ExprKind::Lambda{parameter,body}=>{
                let arg=self.fresh();
                self.push();
                self.declare(parameter,arg.clone(),false,expr.span)?;
                self.lambda_depth+=1;
                let inferred=self.expression(body);
                self.lambda_depth-=1;
                self.pop();
                let checked=inferred?;
                let ty=Type::Function(vec![arg],Box::new(checked.ty.clone()));
                (TypedExprKind::Lambda{parameter:parameter.clone(),body:Box::new(checked)},ty)
            }
            ExprKind::Number(raw)=>(TypedExprKind::Number(raw.clone()),Type::Number),
            ExprKind::String(raw)=>(TypedExprKind::String(raw.clone()),Type::String),
            ExprKind::Bool(value)=>(TypedExprKind::Bool(*value),Type::Bool),
            ExprKind::Identifier(name)=>{
                let ty=self.lookup(name,expr.span)?.ty;
                (TypedExprKind::Identifier(name.clone()),ty)
            }
            ExprKind::Operation{alias,name_or_glyph,is_glyph}=>{
                let op=self.operation(alias,name_or_glyph,*is_glyph,expr.span)?;
                // Fresh inference variables on EVERY use of a generic sign.
                // A Number call must never constrain a later String call.
                let mut substitutions=HashMap::new();
                for name in &op.type_parameters {
                    substitutions.insert(name.clone(),self.fresh());
                }
                let args=op.parameters.iter().map(|t|Self::instantiate_type(t,&substitutions)).collect();
                let ret=Self::instantiate_type(&op.returns,&substitutions);
                (TypedExprKind::OperationRef{id:op.id},Type::Function(args,Box::new(ret)))
            }
            ExprKind::Unary{op,operand}=>{
                let inner=self.expression(operand)?;
                let (expected,result)=match op {UnaryOp::Not=>(Type::Bool,Type::Bool),UnaryOp::Negate=>(Type::Number,Type::Number)};
                self.unify(&expected,&inner.ty,expr.span,"Invalid unary operand")?;
                (TypedExprKind::Unary{op:*op,operand:Box::new(inner)},result)
            }
            ExprKind::Choice{condition,when_true,when_false}=>{
                let test=self.expression(condition)?;
                self.unify(&Type::Bool,&test.ty,condition.span,"Choice condition must be Bool")?;
                let positive=self.expression(when_true)?;
                let negative=self.expression(when_false)?;
                let ty=self.unify(&positive.ty,&negative.ty,expr.span,"Choice branches must have matching types")?;
                (TypedExprKind::Choice{condition:Box::new(test),when_true:Box::new(positive),when_false:Box::new(negative)},ty)
            }
            ExprKind::Binary{op,left,right}=>{
                let l=self.expression(left)?;
                let r=if matches!(op,BinaryOp::Filter|BinaryOp::Map) &&
                          matches!(right.kind,ExprKind::Lambda{..}){
                    let element=self.fresh();
                    self.unify(&l.ty,&Type::Sequence(Box::new(element.clone())),left.span,
                        "⌕/⇢ requires a typed input sequence")?;
                    let context=self.resolved(&element);
                    self.sequence_lambda(right,context)?
                }else{self.expression(right)?};
                let ty=match op {
                    BinaryOp::Filter=>{
                        let element=self.fresh();
                        let seq=Type::Sequence(Box::new(element.clone()));
                        self.unify(&l.ty,&seq,left.span,"⌕ requires a typed sequence")?;
                        let callback=Type::Function(vec![element],Box::new(Type::Bool));
                        self.unify(&r.ty,&callback,right.span,"⌕ predicate must be unary and return Bool")?;
                        seq
                    }
                    BinaryOp::Map=>{
                        let input=self.fresh();
                        let output=self.fresh();
                        let seq=Type::Sequence(Box::new(input.clone()));
                        self.unify(&l.ty,&seq,left.span,"⇢ requires a typed sequence")?;
                        let callback=Type::Function(vec![input],Box::new(output.clone()));
                        self.unify(&r.ty,&callback,right.span,"⇢ transformer must be unary")?;
                        Type::Sequence(Box::new(output))
                    }
                    BinaryOp::Concat=>{
                        let elem=self.fresh();
                        let list=Type::Sequence(Box::new(elem.clone()));
                        self.unify(&l.ty,&list,left.span,"⧺ left operand must be sequence")?;
                        self.unify(&r.ty,&list,right.span,"⧺ operands must share element type")?;
                        Type::Sequence(Box::new(elem))
                    }
                    BinaryOp::Compose=>{
                        // Composition: (B->C) and (A->B) produce (A->C).
                        let input=self.fresh();
                        let mid=self.fresh();
                        let output=self.fresh();
                        let outer=Type::Function(vec![mid.clone()],Box::new(output.clone()));
                        let inner=Type::Function(vec![input.clone()],Box::new(mid));
                        self.unify(&l.ty,&outer,expr.span,"Composition left operand must be unary callable")?;
                        self.unify(&r.ty,&inner,expr.span,"Composition right operand must be unary callable")?;
                        Type::Function(vec![input],Box::new(output))
                    }
                    BinaryOp::Add=>{
                        let merged=self.unify(&l.ty,&r.ty,expr.span,"+ operands must have matching types")?;
                        self.pending_add.push((merged.clone(),expr.span));merged
                    }
                    BinaryOp::Subtract|BinaryOp::Multiply|BinaryOp::Divide|BinaryOp::Modulo=>{
                        self.unify(&Type::Number,&l.ty,expr.span,"Arithmetic expects Number")?;
                        self.unify(&Type::Number,&r.ty,expr.span,"Arithmetic expects Number")?;
                        Type::Number
                    }
                    BinaryOp::Less|BinaryOp::Greater|BinaryOp::LessEqual|BinaryOp::GreaterEqual=>{
                        self.unify(&Type::Number,&l.ty,expr.span,"Comparison expects Number")?;
                        self.unify(&Type::Number,&r.ty,expr.span,"Comparison expects Number")?;
                        Type::Bool
                    }
                    BinaryOp::Equal|BinaryOp::NotEqual=>{
                        let merged=self.unify(&l.ty,&r.ty,expr.span,"Equality operands must have matching types")?;
                        self.pending_equal.push((merged,expr.span));Type::Bool
                    }
                    BinaryOp::And|BinaryOp::Or=>{
                        self.unify(&Type::Bool,&l.ty,expr.span,"Logical operator expects Bool")?;
                        self.unify(&Type::Bool,&r.ty,expr.span,"Logical operator expects Bool")?;
                        Type::Bool
                    }
                };
                (TypedExprKind::Binary{op:*op,left:Box::new(l),right:Box::new(r)},ty)
            }
            ExprKind::Call{callee,arguments}=>{
                let called=self.expression(callee)?;
                let mut args=Vec::new();
                for argument in arguments {args.push(self.expression(argument)?);}
                let resolved_callee=self.resolved(&called.ty);
                let ty=if resolved_callee==Type::BuiltinPrint {
                    Type::Unit
                } else {
                    let ret=self.fresh();
                    let signature=Type::Function(args.iter().map(|a|a.ty.clone()).collect(),Box::new(ret.clone()));
                    self.unify(&called.ty,&signature,expr.span,"Call argument types or arity mismatch")?;
                    ret
                };
                (TypedExprKind::Call{callee:Box::new(called),arguments:args},ty)
            }
        };
        Ok(TypedExpr{kind,ty,span:expr.span})
    }
    fn verify_constraints(&self)->Result<(),Diagnostic>{
        for (ty,span) in &self.pending_add {
            let t=self.resolved(ty);
            if !matches!(t,Type::Number|Type::String){return Err(Diagnostic::new("TYPE",format!("+ requires Number or String, got {t:?}"),*span));}
        }
        for (ty,span) in &self.pending_equal {
            let t=self.resolved(ty);
            if !matches!(t,Type::Number|Type::String|Type::Bool|Type::Unit){return Err(Diagnostic::new("TYPE",format!("Equality requires a primitive comparable type, got {t:?}"),*span));}
        }
        Ok(())
    }
    fn require_known(&self,ty:&Type,span:Span)->Result<Type,Diagnostic>{
        let result=self.resolved(ty);
        if contains_variable(&result){return Err(Diagnostic::new("TYPE",format!("Cannot infer type {result:?}; add a type annotation"),span));}
        Ok(result)
    }
    fn finalize_program(&self,program:&mut TypedProgram)->Result<(),Diagnostic>{
        for stmt in &mut program.statements {self.finalize_stmt(stmt)?;}
        Ok(())
    }
    fn finalize_stmt(&self,s:&mut TypedStmt)->Result<(),Diagnostic>{
        match &mut s.kind {
            TypedStmtKind::Use{..}|TypedStmtKind::Import{..}=>{},
            TypedStmtKind::Export{declaration}=>self.finalize_stmt(declaration)?,
            TypedStmtKind::Let{value,..}|TypedStmtKind::Assign{value,..}|TypedStmtKind::Return(value)|TypedStmtKind::Expression(value)=>self.finalize_expr(value)?,
            TypedStmtKind::Function{parameters,returns,body,..}=>{
                for (_,p) in parameters { *p=self.require_known(p,s.span)?; }
                *returns=self.require_known(returns,s.span)?;
                for child in body {self.finalize_stmt(child)?;}
            }
            TypedStmtKind::If{condition,then_body,else_body}=>{
                self.finalize_expr(condition)?;
                for child in then_body {self.finalize_stmt(child)?;}
                if let Some(b)=else_body{for child in b{self.finalize_stmt(child)?;}}
            }
            TypedStmtKind::While{condition,body}=>{
                self.finalize_expr(condition)?;
                for child in body{self.finalize_stmt(child)?;}
            }
        }
        Ok(())
    }
    fn finalize_expr(&self,e:&mut TypedExpr)->Result<(),Diagnostic>{
        e.ty=self.require_known(&e.ty,e.span)?;
        match &mut e.kind {
            TypedExprKind::Sequence(items)=>{for item in items {self.finalize_expr(item)?;}},
            TypedExprKind::Record(fields)=>{for (_,value) in fields{self.finalize_expr(value)?;}},
            TypedExprKind::Field{record,..}=>self.finalize_expr(record)?,
            TypedExprKind::JsonRead{value,..}|TypedExprKind::JsonWrite{value,..}=>self.finalize_expr(value)?,
            TypedExprKind::TextScalars(value)|TypedExprKind::TextWords(value)|TypedExprKind::Histogram(value)|TypedExprKind::FileRead(value)|TypedExprKind::HttpGet(value)|TypedExprKind::Sleep(value)|TypedExprKind::ArithEval(value)=>self.finalize_expr(value)?,
            TypedExprKind::CsvTyped{value,..}=>self.finalize_expr(value)?,
            TypedExprKind::FileWrite{filename,content}=>{self.finalize_expr(filename)?;self.finalize_expr(content)?;},
            TypedExprKind::RecordUpdate{record,value,..}=>{self.finalize_expr(record)?;self.finalize_expr(value)?;},
            TypedExprKind::Index{sequence,index}=>{self.finalize_expr(sequence)?;self.finalize_expr(index)?;},
            TypedExprKind::Length(value)=>self.finalize_expr(value)?,
            TypedExprKind::Sum(value)=>self.finalize_expr(value)?,
            TypedExprKind::Lambda{body,..}=>self.finalize_expr(body)?,
            TypedExprKind::Section{right,..}=>self.finalize_expr(right)?,
            TypedExprKind::Unary{operand,..}=>self.finalize_expr(operand)?,
            TypedExprKind::Binary{left,right,..}=>{self.finalize_expr(left)?;self.finalize_expr(right)?;},
            TypedExprKind::Choice{condition,when_true,when_false}=>{
                self.finalize_expr(condition)?;
                self.finalize_expr(when_true)?;
                self.finalize_expr(when_false)?;
            },
            TypedExprKind::Call{callee,arguments}=>{
                self.finalize_expr(callee)?;
                for a in arguments{self.finalize_expr(a)?;}
            }
            _=>{}
        }
        Ok(())
    }
}
fn contains_variable(t:&Type)->bool {
    match t{Type::Variable(_)=>true,Type::Function(ps,r)=>ps.iter().any(contains_variable)||contains_variable(r),Type::Sequence(t)=>contains_variable(t),Type::Record(fields)=>fields.iter().any(|(_,ty)|contains_variable(ty)),_=>false}
}
fn statement_returns(s:&Stmt)->bool {
    match &s.kind{
        StmtKind::Export{declaration}=>statement_returns(declaration),
        StmtKind::Return(_)=>true,
        StmtKind::If{then_body,else_body:Some(other),..}=>{
            body_returns(then_body)&&body_returns(other)
        },
        _=>false
    }
}
fn body_returns(body:&[Stmt])->bool {body.iter().any(statement_returns)}
fn valid_package_spec(s:&str)->bool {
    let Some((name,version))=s.rsplit_once('@') else{return false};
    if name.is_empty() || !name.starts_with(|c:char|c.is_ascii_lowercase()) ||
       !name.chars().all(|c|c.is_ascii_lowercase()||c.is_ascii_digit()||c=='-'||c=='.') {return false;}
    let parts:Vec<&str>=version.split('.').collect();
    parts.len()==3 && parts.iter().all(|p|!p.is_empty()&&p.chars().all(|c|c.is_ascii_digit())&& (p==&"0"||!p.starts_with('0')))
}
