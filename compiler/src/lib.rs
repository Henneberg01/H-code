//! H-Code M2 static frontend, independent of the M1 JavaScript reference runtime.
pub mod ast;
pub mod checker;
pub mod lexer;
pub mod packages;
pub mod parser;

use lexer::Span;
use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Diagnostic { pub code: &'static str, pub message: String, pub span: Span }
impl Diagnostic {
    pub fn new(code:&'static str,message:String,span:Span)->Self{Self{code,message,span}}
}
impl fmt::Display for Diagnostic {
    fn fmt(&self,f:&mut fmt::Formatter<'_>)->fmt::Result{
        write!(f,"{}:{}: {}: {}",self.span.line,self.span.column,self.code,self.message)
    }
}
impl std::error::Error for Diagnostic {}
