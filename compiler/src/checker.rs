//! M2 static type inference, scoped name resolution and typed AST construction.
//! Program checking is conservative: unknown types and ambiguous `+` are errors,
//! not runtime guesses. Imported symbols have the exact contracts from their lockfile.
use std::collections::{HashMap};
use crate::{Diagnostic,ast::{Program,Stmt,StmtKind,Expr,ExprKind,UnaryOp,BinaryOp},lexer::Span,packages::{PackageRegistry,OperationSig}};

#[derive(Clone,Debug,PartialEq,Eq)]
pub enum Type {
    Number, String, Bool, Unit,
    Function(Vec<Type>,Box<Type>),
    Variable(u32),
    BuiltinPrint,
}
impl Type {
    pub(crate) fn from_name(name:&str,span:Span)->Result<Type,Diagnostic>{
        match name {
            "Number"=>Ok(Self::Number),"String"=>Ok(Self::String),"Bool"=>Ok(Self::Bool),"Unit"=>Ok(Self::Unit),
            _=>Err(Diagnostic::new("TYPE",format!("Unknown type {name}"),span))
        }
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
    Call { callee:Box<TypedExpr>,arguments:Vec<TypedExpr> },
}

#[derive(Clone)]
struct Binding { ty:Type,assignable:bool }
struct ActiveFunction { expected:Type,saw_return:bool }

pub fn check(program:&Program, registry:&PackageRegistry, allow_print:bool)->Result<TypedProgram,Diagnostic>{
    let mut checker=Checker{
        scopes:vec![HashMap::new()],substitutions:HashMap::new(),fresh:0,
        imported:HashMap::new(),glyphs:HashMap::new(),active_function:None,
        pending_add:Vec::new(),pending_equal:Vec::new(),allow_print
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
}
impl Checker {
    fn fresh(&mut self)->Type {let n=self.fresh;self.fresh+=1;Type::Variable(n)}
    fn resolved(&self,ty:&Type)->Type {
        match ty {
            Type::Variable(id)=>match self.substitutions.get(id){Some(x)=>self.resolved(x),None=>ty.clone()},
            Type::Function(params,ret)=>Type::Function(params.iter().map(|x|self.resolved(x)).collect(),Box::new(self.resolved(ret))),
            _=>ty.clone()
        }
    }
    fn occurs(&self,id:u32,ty:&Type)->bool {
        match self.resolved(ty){Type::Variable(n)=>id==n,
            Type::Function(a,r)=>a.iter().any(|t|self.occurs(id,t))||self.occurs(id,&r),_=>false}
    }
    fn unify(&mut self,left:&Type,right:&Type,span:Span,reason:&str)->Result<Type,Diagnostic>{
        let a=self.resolved(left);let b=self.resolved(right);
        if a==b {return Ok(a);}
        match (&a,&b){
            (Type::Variable(id),other)|(other,Type::Variable(id))=>{
                if self.occurs(*id,other){return Err(Diagnostic::new("TYPE",format!("{reason}: recursive type"),span));}
                self.substitutions.insert(*id,other.clone()); Ok(other.clone())
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
        for stmt in statements {
            let StmtKind::Function{name,parameters,returns,..}=&stmt.kind else {continue};
            if self.scopes.len()==1 && self.imported.contains_key(name) {
                return Err(Diagnostic::new("TYPE",format!("Function {name} conflicts with package alias"),stmt.span));
            }
            let mut args=Vec::new();
            for param in parameters {
                args.push(match &param.annotation {
                    Some(a)=>Type::from_name(a,param.span)?,None=>self.fresh()
                });
            }
            let result=match returns{Some(t)=>Type::from_name(t,stmt.span)?,None=>self.fresh()};
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
            StmtKind::Let{name,value}=>{
                if self.scopes.len()==1 && self.imported.contains_key(name) {
                    return Err(Diagnostic::new("TYPE",format!("Declaration {name} conflicts with package alias"),node.span));
                }
                let expr=self.expression(value)?;
                self.declare(name,expr.ty.clone(),true,node.span)?;
                TypedStmtKind::Let{name:name.clone(),value:expr}
            }
            StmtKind::Assign{name,value}=>{
                let binding=self.lookup(name,node.span)?;
                if !binding.assignable {return Err(Diagnostic::new("TYPE",format!("Cannot assign to function or builtin {name}"),node.span));}
                let expr=self.expression(value)?;
                self.unify(&binding.ty,&expr.ty,node.span,"Assignment type mismatch")?;
                TypedStmtKind::Assign{name:name.clone(),value:expr}
            }
            StmtKind::Function{name,parameters,body,..}=>{
                let binding=self.lookup(name,node.span)?;
                let Type::Function(params,ret)=binding.ty else {unreachable!("predeclared function")};
                self.push();
                for (param,ty) in parameters.iter().zip(params.iter()) {
                    self.declare(&param.name,ty.clone(),true,param.span)?;
                }
                let previous=self.active_function.take();
                self.active_function=Some(ActiveFunction{expected:(*ret).clone(),saw_return:false});
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
    fn expression(&mut self,expr:&Expr)->Result<TypedExpr,Diagnostic>{
        let (kind,ty)=match &expr.kind {
            ExprKind::Number(raw)=>(TypedExprKind::Number(raw.clone()),Type::Number),
            ExprKind::String(raw)=>(TypedExprKind::String(raw.clone()),Type::String),
            ExprKind::Bool(value)=>(TypedExprKind::Bool(*value),Type::Bool),
            ExprKind::Identifier(name)=>{
                let ty=self.lookup(name,expr.span)?.ty;
                (TypedExprKind::Identifier(name.clone()),ty)
            }
            ExprKind::Operation{alias,name_or_glyph,is_glyph}=>{
                let op=self.operation(alias,name_or_glyph,*is_glyph,expr.span)?;
                (TypedExprKind::OperationRef{id:op.id},Type::Function(op.parameters,Box::new(op.returns)))
            }
            ExprKind::Unary{op,operand}=>{
                let inner=self.expression(operand)?;
                let (expected,result)=match op {UnaryOp::Not=>(Type::Bool,Type::Bool),UnaryOp::Negate=>(Type::Number,Type::Number)};
                self.unify(&expected,&inner.ty,expr.span,"Invalid unary operand")?;
                (TypedExprKind::Unary{op:*op,operand:Box::new(inner)},result)
            }
            ExprKind::Binary{op,left,right}=>{
                let l=self.expression(left)?;let r=self.expression(right)?;
                let ty=match op {
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
            TypedExprKind::Unary{operand,..}=>self.finalize_expr(operand)?,
            TypedExprKind::Binary{left,right,..}=>{self.finalize_expr(left)?;self.finalize_expr(right)?;},
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
    match t{Type::Variable(_)=>true,Type::Function(ps,r)=>ps.iter().any(contains_variable)||contains_variable(r),_=>false}
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
