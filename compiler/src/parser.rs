use crate::{ast::*, lexer::{lex, Span, Token, TokenKind}, Diagnostic};
use std::mem::discriminant;

pub fn parse(source: &str) -> Result<Program, Diagnostic> {
    let tokens=lex(source)?;
    Parser{tokens,index:0}.program()
}

struct Parser { tokens: Vec<Token>, index: usize }
impl Parser {
    fn peek(&self)->&Token { &self.tokens[self.index.min(self.tokens.len()-1)] }
    fn lookahead(&self,n:usize)->&Token { &self.tokens[(self.index+n).min(self.tokens.len()-1)] }
    fn at(&self, expected: &TokenKind) -> bool { discriminant(&self.peek().kind)==discriminant(expected) }
    fn accept(&mut self, expected: &TokenKind)->Option<Token> { if self.at(expected) { let t=self.peek().clone();self.index+=1;Some(t) } else { None } }
    fn expect(&mut self, expected: &TokenKind)->Result<Token,Diagnostic> {
        self.accept(expected).ok_or_else(||Diagnostic::new("PARSE",format!("Expected {expected:?}, got {:?}",self.peek().kind),self.peek().span))
    }
    fn ident(&mut self)->Result<(String,Span),Diagnostic> {
        let t=self.expect(&TokenKind::Identifier(String::new()))?;
        if let TokenKind::Identifier(name)=t.kind { Ok((name,t.span)) } else { unreachable!() }
    }
    fn program(&mut self)->Result<Program,Diagnostic> {
        let mut statements=Vec::new();
        while !self.at(&TokenKind::Eof) { statements.push(self.statement(true)?); }
        Ok(Program{statements})
    }
    fn block(&mut self)->Result<Vec<Stmt>,Diagnostic> {
        self.expect(&TokenKind::LeftBrace)?;
        let mut body=Vec::new();
        while !self.at(&TokenKind::RightBrace) {
            if self.at(&TokenKind::Eof) { self.expect(&TokenKind::RightBrace)?; }
            body.push(self.statement(false)?);
        }
        self.expect(&TokenKind::RightBrace)?;
        Ok(body)
    }
    // M15 checks source spans rather than manufacturing newline tokens in expressions.
    fn statement_end(&mut self)->Result<(),Diagnostic>{
        if self.accept(&TokenKind::Semicolon).is_some(){return Ok(());}
        let next=self.peek();
        let certain=matches!(next.kind,
            TokenKind::Eof|TokenKind::RightBrace|TokenKind::Fn|TokenKind::Let|
            TokenKind::Return|TokenKind::If|TokenKind::While|TokenKind::Use|
            TokenKind::Import|TokenKind::Export|TokenKind::Else|TokenKind::Forall);
        let previous=self.index.checked_sub(1).and_then(|i|self.tokens.get(i));
        if certain || previous.is_some_and(|t|next.span.line>t.span.line){return Ok(());}
        Err(Diagnostic::new("PARSE",
            "Expected ; or an unambiguous statement boundary".into(),next.span))
    }
    // Single statement ⇒ lowers to the same AST list used by { statement }.
    fn control_body(&mut self)->Result<Vec<Stmt>,Diagnostic>{
        if self.accept(&TokenKind::Then).is_some(){
            return Ok(vec![self.statement(false)?]);
        }
        self.block()
    }
    fn type_name(&mut self)->Result<String,Diagnostic>{
        if self.accept(&TokenKind::SeqOpen).is_some(){
            let inner=self.type_name()?;
            self.expect(&TokenKind::SeqClose)?;
            Ok(format!("⟦{inner}⟧"))
        } else if self.at(&TokenKind::RecOpen) || self.at(&TokenKind::LeftBrace) {
            // ASCII braces and symbol braces normalize to the same canonical type.
            let closing=if self.accept(&TokenKind::RecOpen).is_some(){TokenKind::RecClose}
                else{self.expect(&TokenKind::LeftBrace)?;TokenKind::RightBrace};
            let mut fields:Vec<(String,String)>=Vec::new();
            while !self.at(&closing){
                if fields.len()>=64{return Err(Diagnostic::new("PARSE","Record type has over 64 fields".into(),self.peek().span));}
                let (name,at)=self.ident()?;
                if fields.iter().any(|(key,_)|key==&name){
                    return Err(Diagnostic::new("PARSE",format!("Duplicate record field {name}"),at));
                }
                self.expect(&TokenKind::Colon)?;
                let ty=self.type_name()?;
                fields.push((name,ty));
                if self.accept(&TokenKind::Comma).is_none(){break;}
            }
            self.expect(&closing)?;
            Ok(format!("⦃{}⦄",fields.into_iter().map(|(key,ty)|format!("{key}:{ty}")).collect::<Vec<_>>().join(",")))
        } else {Ok(self.ident()?.0)}
    }
    fn statement(&mut self,top_level:bool)->Result<Stmt,Diagnostic>{
        let span=self.peek().span;
        let kind=match &self.peek().kind {
            TokenKind::Use=>{
                self.index+=1;
                if !top_level {return Err(Diagnostic::new("PARSE","Package imports must be top-level".into(),span));}
                let package=match self.expect(&TokenKind::String(String::new()))?.kind {
                    TokenKind::String(s)=>s,_=>unreachable!()};
                self.expect(&TokenKind::As)?;
                let (alias,_)=self.ident()?;
                self.statement_end()?;
                StmtKind::Use{package,alias}
            }
            TokenKind::Import=>{
                self.index+=1;
                if !top_level {return Err(Diagnostic::new("PARSE","Module imports must be top-level".into(),span));}
                let source=match self.expect(&TokenKind::String(String::new()))?.kind{TokenKind::String(s)=>s,_=>unreachable!()};
                self.expect(&TokenKind::As)?;
                let (alias,_)=self.ident()?;
                self.statement_end()?;
                StmtKind::Import{source,alias}
            }
            TokenKind::Export=>{
                self.index+=1;
                if !top_level {return Err(Diagnostic::new("PARSE","Exports must be top-level".into(),span));}
                if !self.at(&TokenKind::Fn) && !self.at(&TokenKind::Let){return Err(Diagnostic::new("PARSE","Only functions and values may be exported".into(),span));}
                StmtKind::Export{declaration:Box::new(self.statement(true)?)}
            }
            TokenKind::Let=>{
                self.index+=1;let (name,_)=self.ident()?;
                let annotation=if self.accept(&TokenKind::Colon).is_some(){Some(self.type_name()?)}else{None};
                self.expect(&TokenKind::Assign)?;
                let value=self.expression(0)?;self.statement_end()?;
                StmtKind::Let{name,annotation,value}
            }
            TokenKind::Forall=>{
                self.index+=1;
                if !top_level {return Err(Diagnostic::new("PARSE","∀ declarations must be top-level".into(),span));}
                let mut bound=Vec::new();
                loop {
                    let (name,at)=self.ident()?;
                    if !name.starts_with(|c:char|c.is_ascii_uppercase()) ||
                        name.len()>32 || matches!(name.as_str(),"Number"|"String"|"Bool"|"Unit") ||
                        bound.contains(&name) || bound.len()>=8 {
                        return Err(Diagnostic::new("PARSE",format!("Invalid or duplicate ∀ binder {name}"),at));
                    }
                    bound.push(name);
                    if self.accept(&TokenKind::Comma).is_none(){break;}
                }
                self.expect(&TokenKind::Fn)?;
                let (name,_)=self.ident()?;
                self.expect(&TokenKind::LeftParen)?;
                let mut parameters=Vec::new();
                if !self.at(&TokenKind::RightParen) {
                    loop {
                        let (name,param_span)=self.ident()?;
                        let annotation=if self.accept(&TokenKind::Colon).is_some(){Some(self.type_name()?)}else{None};
                        parameters.push(Parameter{name,annotation,span:param_span});
                        if self.accept(&TokenKind::Comma).is_none(){break;}
                    }
                }
                self.expect(&TokenKind::RightParen)?;
                let returns=if self.accept(&TokenKind::Arrow).is_some(){Some(self.type_name()?)}else{None};
                let body=if self.at(&TokenKind::LeftBrace){self.block()?}else{
                    let ret=self.expect(&TokenKind::Return)?;
                    let value=self.expression(0)?;self.statement_end()?;
                    vec![Stmt{kind:StmtKind::Return(value),span:ret.span}]
                };
                StmtKind::Function{name,type_parameters:bound,parameters,returns,body}
            }
            TokenKind::Fn=>{
                self.index+=1;let (name,_)=self.ident()?;
                self.expect(&TokenKind::LeftParen)?;
                let mut parameters=Vec::new();
                if !self.at(&TokenKind::RightParen) {
                    loop {
                        let (name,param_span)=self.ident()?;
                        let annotation=if self.accept(&TokenKind::Colon).is_some(){Some(self.type_name()?)} else {None};
                        parameters.push(Parameter{name,annotation,span:param_span});
                        if self.accept(&TokenKind::Comma).is_none(){break;}
                    }
                }
                self.expect(&TokenKind::RightParen)?;
                let returns=if self.accept(&TokenKind::Arrow).is_some(){Some(self.type_name()?)} else {None};
                let body=if self.at(&TokenKind::LeftBrace) {self.block()?} else {
                    let ret=self.expect(&TokenKind::Return)?;
                    let value=self.expression(0)?;
                    self.statement_end()?;
                    vec![Stmt{kind:StmtKind::Return(value),span:ret.span}]
                };
                StmtKind::Function{name,type_parameters:Vec::new(),parameters,returns,body}
            }
            TokenKind::Return=>{
                self.index+=1;let value=self.expression(0)?;
                self.statement_end()?;StmtKind::Return(value)
            }
            TokenKind::If=>{
                self.index+=1;self.expect(&TokenKind::LeftParen)?;
                let condition=self.expression(0)?;
                self.expect(&TokenKind::RightParen)?;
                let then_body=self.control_body()?;
                let else_body=if self.accept(&TokenKind::Else).is_some(){Some(self.control_body()?)}else{None};
                StmtKind::If{condition,then_body,else_body}
            }
            TokenKind::While=>{
                self.index+=1;self.expect(&TokenKind::LeftParen)?;
                let condition=self.expression(0)?;
                self.expect(&TokenKind::RightParen)?;
                let body=self.control_body()?;
                StmtKind::While{condition,body}
            }
            TokenKind::Identifier(_) if self.lookahead(1).kind == TokenKind::Assign=>{
                let (name,_)=self.ident()?;self.expect(&TokenKind::Assign)?;
                let value=self.expression(0)?;self.statement_end()?;
                StmtKind::Assign{name,value}
            }
            _=>{
                let value=self.expression(0)?;
                self.statement_end()?;
                StmtKind::Expression(value)
            }
        };
        Ok(Stmt{kind,span})
    }
    fn binary_operator(&self)->Option<BinaryOp>{
        Some(match self.peek().kind {
            TokenKind::Or=>BinaryOp::Or, TokenKind::And=>BinaryOp::And,
            TokenKind::Equal=>BinaryOp::Equal,TokenKind::NotEqual=>BinaryOp::NotEqual,
            TokenKind::Less=>BinaryOp::Less,TokenKind::Greater=>BinaryOp::Greater,
            TokenKind::LessEqual=>BinaryOp::LessEqual,TokenKind::GreaterEqual=>BinaryOp::GreaterEqual,
            TokenKind::Plus=>BinaryOp::Add,TokenKind::Minus=>BinaryOp::Subtract,
            TokenKind::Star=>BinaryOp::Multiply,TokenKind::Slash=>BinaryOp::Divide,
            TokenKind::Percent=>BinaryOp::Modulo,TokenKind::Compose=>BinaryOp::Compose,
            TokenKind::SeqConcat=>BinaryOp::Concat,
            TokenKind::Filter=>BinaryOp::Filter,TokenKind::Map=>BinaryOp::Map,
            TokenKind::SortDesc=>BinaryOp::SortDesc,_=>return None
        })
    }
    fn expression(&mut self,min_power:u8)->Result<Expr,Diagnostic>{
        let span=self.peek().span;
        let kind=match self.peek().kind.clone(){
            TokenKind::Not=>{
                self.index+=1; ExprKind::Unary{op:UnaryOp::Not,operand:Box::new(self.expression(8)?)}
            }
            TokenKind::Minus=>{
                self.index+=1; ExprKind::Unary{op:UnaryOp::Negate,operand:Box::new(self.expression(8)?)}
            }
            // ⤓<T> is a schema-checked JSON decoder, not unsafe JSON.parse as T.
            TokenKind::JsonRead=>{
                self.index+=1;
                let schema=self.type_name()?;
                let value=self.expression(8)?;
                ExprKind::JsonRead{schema,value:Box::new(value)}
            }
            // ⤔<T> checks an arbitrary String against a statically checked schema.
            // Unlike ⤓, malformed JSON or mismatched fields produce Bool false.
            TokenKind::JsonValid=>{
                self.index+=1;
                let schema=self.type_name()?;
                let value=self.expression(8)?;
                ExprKind::JsonValid{schema,value:Box::new(value)}
            }
            // ⤒ is a schema-safe, deterministic JSON serializer for typed data.
            TokenKind::JsonWrite=>{
                self.index+=1;
                ExprKind::JsonWrite(Box::new(self.expression(8)?))
            }
            TokenKind::StdinText=>{self.index+=1;ExprKind::StdinText}
            TokenKind::ArithEval=>{self.index+=1;ExprKind::ArithEval(Box::new(self.expression(8)?))}
            TokenKind::FileRead=>{self.index+=1;ExprKind::FileRead(Box::new(self.expression(8)?))}
            TokenKind::FileWrite=>{
                self.index+=1;
                self.expect(&TokenKind::LeftParen)?;
                let filename=self.expression(0)?;
                self.expect(&TokenKind::Comma)?;
                let content=self.expression(0)?;
                self.expect(&TokenKind::RightParen)?;
                ExprKind::FileWrite{filename:Box::new(filename),content:Box::new(content)}
            }
            TokenKind::HttpGet=>{self.index+=1;ExprKind::HttpGet(Box::new(self.expression(8)?))}
            TokenKind::HttpServe=>{
                self.index+=1;
                if self.accept(&TokenKind::LeftParen).is_some(){
                    let handler=self.expression(0)?;
                    self.expect(&TokenKind::Comma)?;
                    let initial=self.expression(0)?;
                    self.expect(&TokenKind::RightParen)?;
                    ExprKind::HttpServeState{handler:Box::new(handler),initial:Box::new(initial)}
                } else {ExprKind::HttpServe(Box::new(self.expression(8)?))}
            }
            TokenKind::Sleep=>{self.index+=1;ExprKind::Sleep(Box::new(self.expression(8)?))}
            TokenKind::CsvTyped=>{self.index+=1;let schema=self.type_name()?;ExprKind::CsvTyped{schema,value:Box::new(self.expression(8)?)}}
            TokenKind::DbRows=>{
                self.index+=1;
                let schema=self.type_name()?;
                self.expect(&TokenKind::LeftParen)?;
                let database=self.expression(0)?;
                self.expect(&TokenKind::Comma)?;
                let table_or_sql=self.expression(0)?;
                if self.accept(&TokenKind::Comma).is_some() {
                    let params=self.expression(0)?;
                    self.expect(&TokenKind::RightParen)?;
                    ExprKind::DbRows{schema,database:Box::new(database),
                        sql:Box::new(table_or_sql),params:Box::new(params)}
                }else{
                    self.expect(&TokenKind::RightParen)?;
                    // Direct typed table projection; never requires raw SQL source.
                    ExprKind::DbTable{schema,database:Box::new(database),table:Box::new(table_or_sql)}
                }
            }
            TokenKind::TextScalars=>{self.index+=1;ExprKind::TextScalars(Box::new(self.expression(8)?))}
            TokenKind::TextWords=>{self.index+=1;ExprKind::TextWords(Box::new(self.expression(8)?))}
            TokenKind::Histogram=>{self.index+=1;ExprKind::Histogram(Box::new(self.expression(8)?))}
            TokenKind::Markdown=>{self.index+=1;ExprKind::Markdown(Box::new(self.expression(8)?))}
            TokenKind::SeqLength=>{self.index+=1;ExprKind::Length(Box::new(self.expression(8)?))}
            TokenKind::Sum=>{self.index+=1;ExprKind::Sum(Box::new(self.expression(8)?))}
            TokenKind::Lambda=>{
                self.index+=1;
                let (parameter,_)=self.ident()?;
                self.expect(&TokenKind::Colon)?;
                let body=self.expression(0)?;
                ExprKind::Lambda{parameter,body:Box::new(body)}
            }
            TokenKind::SeqOpen=>{
                self.index+=1;
                let mut items=Vec::new();
                if !self.at(&TokenKind::SeqClose){
                    loop{
                        items.push(self.expression(0)?);
                        if self.accept(&TokenKind::Comma).is_none(){break;}
                    }
                }
                self.expect(&TokenKind::SeqClose)?;
                ExprKind::Sequence(items)
            }
            TokenKind::RecOpen|TokenKind::LeftBrace=>{
                let closing=if self.accept(&TokenKind::RecOpen).is_some(){TokenKind::RecClose}
                    else{self.expect(&TokenKind::LeftBrace)?;TokenKind::RightBrace};
                let mut fields:Vec<(String,Expr)>=Vec::new();
                while !self.at(&closing){
                    if fields.len()>=64{return Err(Diagnostic::new("PARSE","Record has over 64 fields".into(),self.peek().span));}
                    let (name,at)=self.ident()?;
                    if fields.iter().any(|(key,_)|key==&name){
                        return Err(Diagnostic::new("PARSE",format!("Duplicate record field {name}"),at));
                    }
                    self.expect(&TokenKind::Colon)?;
                    let value=self.expression(0)?;
                    fields.push((name,value));
                    if self.accept(&TokenKind::Comma).is_none(){break;}
                }
                self.expect(&closing)?;
                ExprKind::Record(fields)
            }
            TokenKind::Number(value)=>{self.index+=1;ExprKind::Number(value)}
            TokenKind::String(value)=>{self.index+=1;ExprKind::String(value)}
            TokenKind::True=>{self.index+=1;ExprKind::Bool(true)}
            TokenKind::False=>{self.index+=1;ExprKind::Bool(false)}
            TokenKind::Identifier(name)=>{
                self.index+=1;
                if self.accept(&TokenKind::DoubleColon).is_some() {
                    let part=self.peek().clone();
                    let (name_or_glyph,is_glyph)=match part.kind {
                        TokenKind::Identifier(x)=>(x,false),TokenKind::Glyph(g)=>(g.to_string(),true),
                        _=>return Err(Diagnostic::new("PARSE","Expected operation name or symbol after ::".into(),part.span))
                    };
                    self.index+=1;
                    ExprKind::Operation{alias:Some(name),name_or_glyph,is_glyph}
                } else {ExprKind::Identifier(name)}
            }
            TokenKind::Glyph(c)=>{self.index+=1;ExprKind::Operation{alias:None,name_or_glyph:c.to_string(),is_glyph:true}}
            TokenKind::LeftParen=>{
                self.index+=1;
                let section_operator=match &self.peek().kind {
                    TokenKind::Plus|TokenKind::Star|TokenKind::Slash|TokenKind::Percent|
                    TokenKind::Less|TokenKind::Greater|TokenKind::LessEqual|TokenKind::GreaterEqual|
                    TokenKind::Equal|TokenKind::NotEqual=>self.binary_operator(),
                    _=>None
                };
                if let Some(op)=section_operator {
                    self.index+=1;
                    let right=self.expression(0)?;
                    self.expect(&TokenKind::RightParen)?;
                    return self.suffixes(Expr{kind:ExprKind::Section{op,right:Box::new(right)},span},min_power);
                }
                let value=self.expression(0)?;self.expect(&TokenKind::RightParen)?;
                return self.suffixes(value,min_power);
            }
            _=>return Err(Diagnostic::new("PARSE",format!("Expected expression, got {:?}",self.peek().kind),self.peek().span))
        };
        self.suffixes(Expr{kind,span},min_power)
    }
    fn pipe_target(&mut self)->Result<(Expr,Vec<Expr>),Diagnostic>{
        let token=self.peek().clone();
        let kind=match token.kind {
            TokenKind::Identifier(name)=>{
                self.index+=1;
                if self.accept(&TokenKind::DoubleColon).is_some(){
                    let member=self.peek().clone();
                    let (name_or_glyph,is_glyph)=match member.kind{
                        TokenKind::Identifier(s)=>(s,false),
                        TokenKind::Glyph(c)=>(c.to_string(),true),
                        _=>return Err(Diagnostic::new("PARSE","Expected operation name or symbol after ::".into(),member.span))
                    };
                    self.index+=1;
                    ExprKind::Operation{alias:Some(name),name_or_glyph,is_glyph}
                } else {ExprKind::Identifier(name)}
            }
            TokenKind::Glyph(g)=>{
                self.index+=1;
                ExprKind::Operation{alias:None,name_or_glyph:g.to_string(),is_glyph:true}
            }
            TokenKind::LeftParen=>{
                self.index+=1;
                let section=match self.peek().kind {
                    TokenKind::Plus|TokenKind::Star|TokenKind::Slash|TokenKind::Percent|
                    TokenKind::Less|TokenKind::Greater|TokenKind::LessEqual|TokenKind::GreaterEqual|
                    TokenKind::Equal|TokenKind::NotEqual=>self.binary_operator(),
                    _=>None
                };
                if let Some(op)=section {
                    self.index+=1;
                    let right=self.expression(0)?;
                    self.expect(&TokenKind::RightParen)?;
                    return Ok((Expr{kind:ExprKind::Section{op,right:Box::new(right)},span:token.span},Vec::new()));
                }
                let expression=self.expression(0)?;
                self.expect(&TokenKind::RightParen)?;
                return Ok((expression,Vec::new()));
            }
            _=>return Err(Diagnostic::new("PARSE","Pipeline target must be a callable name, package operation or parenthesized callable".into(),token.span))
        };
        let callee=Expr{kind,span:token.span};
        let mut args=Vec::new();
        if self.accept(&TokenKind::LeftParen).is_some(){
            if !self.at(&TokenKind::RightParen){
                loop{
                    args.push(self.expression(0)?);
                    if self.accept(&TokenKind::Comma).is_none(){break;}
                }
            }
            self.expect(&TokenKind::RightParen)?;
        }
        Ok((callee,args))
    }
    fn suffixes(&mut self,mut left:Expr,min_power:u8)->Result<Expr,Diagnostic>{
        loop {
            if self.at(&TokenKind::Field) && 9>=min_power {
                self.index+=1;
                let (name,_)=self.ident()?;
                let span=left.span;
                left=Expr{kind:ExprKind::Field{record:Box::new(left),name},span};
                continue;
            }
            if self.at(&TokenKind::SeqOpen) && 9>=min_power {
                self.index+=1;
                let index=self.expression(0)?;
                self.expect(&TokenKind::SeqClose)?;
                let span=left.span;
                left=Expr{kind:ExprKind::Index{sequence:Box::new(left),index:Box::new(index)},span};
                continue;
            }
            if self.at(&TokenKind::LeftParen) && 9>=min_power {
                let span=left.span;
                self.index+=1;
                let mut arguments=Vec::new();
                if !self.at(&TokenKind::RightParen){
                    loop { arguments.push(self.expression(0)?);if self.accept(&TokenKind::Comma).is_none(){break;} }
                }
                self.expect(&TokenKind::RightParen)?;
                left=Expr{kind:ExprKind::Call{callee:Box::new(left),arguments},span};
                continue;
            }
            if min_power==0 && self.accept(&TokenKind::Pipe).is_some(){
                let (callee,mut explicit_args)=self.pipe_target()?;
                let span=left.span;
                let mut arguments=Vec::with_capacity(explicit_args.len()+1);
                arguments.push(left);
                arguments.append(&mut explicit_args);
                left=Expr{kind:ExprKind::Call{callee:Box::new(callee),arguments},span};
                if self.binary_operator().is_some(){
                    return Err(Diagnostic::new("PARSE","Parenthesize pipeline before another operator".into(),self.peek().span));
                }
                continue;
            }
            // One glyph replaces immutable JS object spread + replacement.
            if min_power==0 && self.accept(&TokenKind::RecordUpdate).is_some(){
                let (name,_)=self.ident()?;
                self.expect(&TokenKind::Colon)?;
                let value=self.expression(0)?;
                let span=left.span;
                left=Expr{kind:ExprKind::RecordUpdate{record:Box::new(left),name,value:Box::new(value)},span};
                continue;
            }
            if min_power==0 && self.accept(&TokenKind::Choice).is_some(){
                let yes=self.expression(0)?;
                self.expect(&TokenKind::Colon)?;
                let no=self.expression(0)?;
                let span=left.span;
                left=Expr{kind:ExprKind::Choice{condition:Box::new(left),when_true:Box::new(yes),when_false:Box::new(no)},span};
                continue;
            }
            let Some(op)=self.binary_operator() else {break};
            let precedence=op.precedence();
            if precedence<min_power {break;}
            self.index+=1;
            let right=self.expression(precedence+1)?;
            let span=left.span;
            left=Expr{kind:ExprKind::Binary{op,left:Box::new(left),right:Box::new(right)},span};
        }
        Ok(left)
    }
}
