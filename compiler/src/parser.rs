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
                self.expect(&TokenKind::Semicolon)?;
                StmtKind::Use{package,alias}
            }
            TokenKind::Import=>{
                self.index+=1;
                if !top_level {return Err(Diagnostic::new("PARSE","Module imports must be top-level".into(),span));}
                let source=match self.expect(&TokenKind::String(String::new()))?.kind{TokenKind::String(s)=>s,_=>unreachable!()};
                self.expect(&TokenKind::As)?;
                let (alias,_)=self.ident()?;
                self.expect(&TokenKind::Semicolon)?;
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
                self.expect(&TokenKind::Assign)?;
                let value=self.expression(0)?;self.expect(&TokenKind::Semicolon)?;
                StmtKind::Let{name,value}
            }
            TokenKind::Fn=>{
                self.index+=1;let (name,_)=self.ident()?;
                self.expect(&TokenKind::LeftParen)?;
                let mut parameters=Vec::new();
                if !self.at(&TokenKind::RightParen) {
                    loop {
                        let (name,param_span)=self.ident()?;
                        let annotation=if self.accept(&TokenKind::Colon).is_some(){Some(self.ident()?.0)} else {None};
                        parameters.push(Parameter{name,annotation,span:param_span});
                        if self.accept(&TokenKind::Comma).is_none(){break;}
                    }
                }
                self.expect(&TokenKind::RightParen)?;
                let returns=if self.accept(&TokenKind::Arrow).is_some(){Some(self.ident()?.0)} else {None};
                let body=self.block()?;
                StmtKind::Function{name,parameters,returns,body}
            }
            TokenKind::Return=>{
                self.index+=1;let value=self.expression(0)?;
                self.expect(&TokenKind::Semicolon)?;StmtKind::Return(value)
            }
            TokenKind::If=>{
                self.index+=1;self.expect(&TokenKind::LeftParen)?;
                let condition=self.expression(0)?;
                self.expect(&TokenKind::RightParen)?;
                let then_body=self.block()?;
                let else_body=if self.accept(&TokenKind::Else).is_some(){Some(self.block()?)}else{None};
                StmtKind::If{condition,then_body,else_body}
            }
            TokenKind::While=>{
                self.index+=1;self.expect(&TokenKind::LeftParen)?;
                let condition=self.expression(0)?;
                self.expect(&TokenKind::RightParen)?;
                let body=self.block()?;
                StmtKind::While{condition,body}
            }
            TokenKind::Identifier(_) if self.lookahead(1).kind == TokenKind::Assign=>{
                let (name,_)=self.ident()?;self.expect(&TokenKind::Assign)?;
                let value=self.expression(0)?;self.expect(&TokenKind::Semicolon)?;
                StmtKind::Assign{name,value}
            }
            _=>{
                let value=self.expression(0)?;
                self.expect(&TokenKind::Semicolon)?;
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
            TokenKind::Percent=>BinaryOp::Modulo,_=>return None
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
                self.index+=1;let value=self.expression(0)?;self.expect(&TokenKind::RightParen)?;
                return self.suffixes(value,min_power);
            }
            _=>return Err(Diagnostic::new("PARSE",format!("Expected expression, got {:?}",self.peek().kind),self.peek().span))
        };
        self.suffixes(Expr{kind,span},min_power)
    }
    fn suffixes(&mut self,mut left:Expr,min_power:u8)->Result<Expr,Diagnostic>{
        loop {
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
