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
    Import { source: String, alias: String },
    Export { declaration: Box<Stmt> },
    Let { name: String, annotation: Option<String>, value: Expr },
    Assign { name: String, value: Expr },
    Function { name: String, type_parameters: Vec<String>, parameters: Vec<Parameter>, returns: Option<String>, body: Vec<Stmt> },
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
    Sequence(Vec<Expr>),
    // M12: record literals are real typed values, not opaque JS templates.
    Record(Vec<(String,Expr)>),
    Field { record: Box<Expr>, name: String },
    RecordUpdate { record: Box<Expr>, name: String, value: Box<Expr> },
    JsonRead { schema: String, value: Box<Expr> },
    JsonValid { schema: String, value: Box<Expr> },
    JsonWrite(Box<Expr>),
    FileRead(Box<Expr>),
    // M19.07: two typed operands; not a CSV->JSON application macro.
    FileWrite { filename:Box<Expr>, content:Box<Expr> },
    // M19.06: effectful, implicitly-awaited GET; symbol ⤋.
    HttpGet(Box<Expr>),
    // M19.12 B1: inbound loopback server effect with typed pure handler.
    HttpServe(Box<Expr>),
    HttpServeState {handler:Box<Expr>,initial:Box<Expr>},
    // Intrinsic bounded asynchronous delay (milliseconds).
    Sleep(Box<Expr>),
    StdinText,
    ArithEval(Box<Expr>),
    CsvTyped { schema: String, value: Box<Expr> },
    TextScalars(Box<Expr>),
    TextWords(Box<Expr>),
    Histogram(Box<Expr>),
    Markdown(Box<Expr>),
    Index { sequence: Box<Expr>, index: Box<Expr> },
    Length(Box<Expr>),
    Sum(Box<Expr>),
    Lambda { parameter: String, body: Box<Expr> },
    Section { op: BinaryOp, right: Box<Expr> },
    Identifier(String),
    Operation { alias: Option<String>, name_or_glyph: String, is_glyph: bool },
    Unary { op: UnaryOp, operand: Box<Expr> },
    Binary { op: BinaryOp, left: Box<Expr>, right: Box<Expr> },
    Choice { condition: Box<Expr>, when_true: Box<Expr>, when_false: Box<Expr> },
    Call { callee: Box<Expr>, arguments: Vec<Expr> },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UnaryOp { Negate, Not }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BinaryOp {
    Add, Subtract, Multiply, Divide, Modulo, Compose, Concat, Filter, Map, Equal, NotEqual,
    Less, Greater, LessEqual, GreaterEqual, And, Or,
}

impl BinaryOp {
    pub fn precedence(self) -> u8 {
        match self {
            Self::Or => 1,
            Self::And => 2,
            Self::Equal | Self::NotEqual => 3,
            Self::Less | Self::Greater | Self::LessEqual | Self::GreaterEqual => 4,
            Self::Add | Self::Subtract | Self::Concat | Self::Filter | Self::Map => 5,
            Self::Multiply | Self::Divide | Self::Modulo => 6,
            Self::Compose => 7,
        }
    }
}
