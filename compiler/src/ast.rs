//! M2 canonical AST. Core glyphs and their ASCII equivalents produce identical operators.
use crate::lexer::Span;

#[derive(Clone, Debug, PartialEq)]
pub struct Program {
    pub statements: Vec<Stmt>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Stmt {
    pub kind: StmtKind,
    pub span: Span,
}

#[derive(Clone, Debug, PartialEq)]
pub enum StmtKind {
    Use { package: String, alias: String },
    Let { name: String, value: Expr },
    Assign { name: String, value: Expr },
    Function { name: String, parameters: Vec<Parameter>, returns: Option<String>, body: Vec<Stmt> },
    Return(Expr),
    If { condition: Expr, then_body: Vec<Stmt>, else_body: Option<Vec<Stmt>> },
    While { condition: Expr, body: Vec<Stmt> },
    Expression(Expr),
}

#[derive(Clone, Debug, PartialEq)]
pub struct Parameter {
    pub name: String,
    pub annotation: Option<String>,
    pub span: Span,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Expr {
    pub kind: ExprKind,
    pub span: Span,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ExprKind {
    Number(String),
    String(String),
    Bool(bool),
    Identifier(String),
    Operation { alias: Option<String>, name_or_glyph: String, is_glyph: bool },
    Unary { op: UnaryOp, operand: Box<Expr> },
    Binary { op: BinaryOp, left: Box<Expr>, right: Box<Expr> },
    Call { callee: Box<Expr>, arguments: Vec<Expr> },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UnaryOp { Negate, Not }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BinaryOp {
    Add, Subtract, Multiply, Divide, Modulo, Equal, NotEqual,
    Less, Greater, LessEqual, GreaterEqual, And, Or,
}

impl BinaryOp {
    pub fn precedence(self) -> u8 {
        match self {
            Self::Or => 1,
            Self::And => 2,
            Self::Equal | Self::NotEqual => 3,
            Self::Less | Self::Greater | Self::LessEqual | Self::GreaterEqual => 4,
            Self::Add | Self::Subtract => 5,
            Self::Multiply | Self::Divide | Self::Modulo => 6,
        }
    }
}
