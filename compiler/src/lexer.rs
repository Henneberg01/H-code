//! Lexical frontend for the H-Code 0.1 reference syntax.
//! This parser is deterministic and does not use AI for interpretation.
use crate::Diagnostic;
use unicode_general_category::{get_general_category, GeneralCategory};
use unicode_normalization::UnicodeNormalization;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Span { pub line: usize, pub column: usize }
impl Span { pub fn new(line: usize, column: usize) -> Self { Self { line, column } } }

#[derive(Clone, Debug, PartialEq)]
pub struct Token { pub kind: TokenKind, pub span: Span }

#[derive(Clone, Debug, PartialEq)]
pub enum TokenKind {
    Fn, Let, Return, If, Else, While, Then, Forall, Use, Import, Export, As, True, False, And, Or, Not,
    Identifier(String), Number(String), String(String), Glyph(char),
    LeftParen, RightParen, LeftBrace, RightBrace, RecOpen, RecClose, Field, RecordUpdate, JsonRead, JsonValid, JsonWrite, TextScalars, TextWords, Histogram, Markdown, FileRead, FileWrite, HttpGet, HttpServe, Sleep, CsvTyped, StdinText, ArithEval, Comma, Semicolon, Colon, DoubleColon, Pipe, Compose, Choice, Lambda, SeqOpen, SeqClose, SeqLength, SeqConcat, Sum, Filter, Map,
    Assign, Arrow, Plus, Minus, Star, Slash, Percent,
    Equal, NotEqual, Less, Greater, LessEqual, GreaterEqual, Eof,
}

pub fn is_symbol(c: char) -> bool {
    matches!(get_general_category(c), GeneralCategory::MathSymbol | GeneralCategory::CurrencySymbol |
        GeneralCategory::ModifierSymbol | GeneralCategory::OtherSymbol)
}

fn disallowed(c: char) -> bool {
    if c.is_control() && !matches!(c, '\r'|'\n'|'\t') { return true; }
    let code = c as u32;
    matches!(code,
       0x00AD | 0x034F | 0x061C | 0x180E | 0x3164 | 0xFEFF | 0xFFA0 |
       0x115F..=0x1160 | 0x17B4..=0x17B5 | 0x200B..=0x200F |
       0x202A..=0x202E | 0x2060..=0x206F | 0xFE00..=0xFE0F |
       0xE0000..=0xE0FFF )
}

pub fn lex(source: &str) -> Result<Vec<Token>, Diagnostic> {
    // NFC is intentional: the source loader and the M1 reference frontend agree on this policy.
    let normalized: String = source.nfc().collect();
    let chars: Vec<char> = normalized.chars().collect();
    let mut result = Vec::new();
    let mut pos = 0usize;
    let mut line = 1usize;
    let mut column = 1usize;
    let err = |message: String, at: Span| Diagnostic::new("LEX", message, at);
    while pos < chars.len() {
        let c = chars[pos];
        let span = Span::new(line, column);
        if disallowed(c) { return Err(err("Forbidden control or invisible Unicode character".into(), span)); }
        let advance = |pos: &mut usize, line: &mut usize, column: &mut usize| -> char {
            let current = chars[*pos]; *pos += 1;
            if current == '\n' { *line += 1; *column = 1; } else { *column += 1; }
            current
        };
        let next = chars.get(pos + 1).copied();
        if c.is_whitespace() { advance(&mut pos, &mut line, &mut column); continue; }
        if c == '/' && next == Some('/') {
            while pos < chars.len() && chars[pos] != '\n' {
                if disallowed(chars[pos]) { return Err(err("Forbidden control or invisible Unicode character".into(), Span::new(line,column))); }
                advance(&mut pos,&mut line,&mut column);
            }
            continue;
        }
        if c == '/' && next == Some('*') {
            advance(&mut pos,&mut line,&mut column);
            advance(&mut pos,&mut line,&mut column);
            let mut closed = false;
            while pos < chars.len() {
                if disallowed(chars[pos]) { return Err(err("Forbidden control or invisible Unicode character".into(), Span::new(line,column))); }
                if chars[pos]=='*' && chars.get(pos+1)==Some(&'/') {
                    advance(&mut pos,&mut line,&mut column);
                    advance(&mut pos,&mut line,&mut column);
                    closed=true; break;
                }
                advance(&mut pos,&mut line,&mut column);
            }
            if !closed { return Err(err("Unterminated block comment".into(), span)); }
            continue;
        }
        if c == '"' {
            advance(&mut pos,&mut line,&mut column);
            let mut value = String::new();
            let mut closed = false;
            while pos < chars.len() {
                let next_span=Span::new(line,column);
                let d = advance(&mut pos,&mut line,&mut column);
                if disallowed(d) { return Err(err("Forbidden control or invisible Unicode character".into(), next_span)); }
                if d == '"' { closed=true; break; }
                if d=='\n' || d=='\r' { return Err(err("Unescaped newline in string literal".into(), next_span)); }
                if d=='\\' {
                    if pos == chars.len() { break; }
                    let escape_span=Span::new(line,column);
                    let escape=advance(&mut pos,&mut line,&mut column);
                    let replacement = match escape { 'n'=>'\n', 'r'=>'\r', 't'=>'\t', '"'=>'"', '\\'=>'\\',
                        _=>return Err(err(format!("Unsupported string escape \\{}",escape),escape_span)) };
                    value.push(replacement);
                } else { value.push(d); }
            }
            if !closed { return Err(err("Unterminated string literal".into(),span)); }
            result.push(Token{kind:TokenKind::String(value),span}); continue;
        }
        if c.is_ascii_digit() {
            let mut number=String::new();
            while pos<chars.len() && chars[pos].is_ascii_digit() { number.push(advance(&mut pos,&mut line,&mut column)); }
            if chars.get(pos)==Some(&'.') && chars.get(pos+1).is_some_and(char::is_ascii_digit) {
                number.push(advance(&mut pos,&mut line,&mut column));
                while pos<chars.len() && chars[pos].is_ascii_digit() { number.push(advance(&mut pos,&mut line,&mut column)); }
            }
            if number.parse::<f64>().is_err() || !number.parse::<f64>().expect("validated number").is_finite() {
                return Err(err("Numeric literal exceeds supported Number range".into(), span));
            }
            result.push(Token{kind:TokenKind::Number(number),span});continue;
        }
        if c.is_ascii_alphabetic() || c=='_' {
            let mut word=String::new();
            while pos < chars.len() && (chars[pos].is_ascii_alphanumeric() || chars[pos]=='_') {
                word.push(advance(&mut pos,&mut line,&mut column));
            }
            let kind = match word.as_str() {
                "fn"=>TokenKind::Fn, "let"=>TokenKind::Let, "return"=>TokenKind::Return,
                "if"=>TokenKind::If,"else"=>TokenKind::Else,"while"=>TokenKind::While,
                "use"=>TokenKind::Use,"import"=>TokenKind::Import,"export"=>TokenKind::Export,"as"=>TokenKind::As,
                "true"=>TokenKind::True,"false"=>TokenKind::False,"and"=>TokenKind::And,
                "or"=>TokenKind::Or,"not"=>TokenKind::Not,"lambda"=>TokenKind::Lambda,"forall"=>TokenKind::Forall,
                "json_in"=>TokenKind::JsonRead,"json_valid"=>TokenKind::JsonValid,"json_out"=>TokenKind::JsonWrite,
                "file_read"=>TokenKind::FileRead,"file_write"=>TokenKind::FileWrite,"http_get"=>TokenKind::HttpGet,"http_serve"=>TokenKind::HttpServe,"sleep_ms"=>TokenKind::Sleep,"csv_typed"=>TokenKind::CsvTyped,
                "stdin_text"=>TokenKind::StdinText,"arith_eval"=>TokenKind::ArithEval,
                "text_scalars"=>TokenKind::TextScalars,"text_words"=>TokenKind::TextWords,
                "text_hist"=>TokenKind::Histogram,"markdown_tokens"=>TokenKind::Markdown,
                _=>TokenKind::Identifier(word)
            };
            result.push(Token{kind,span});continue;
        }
        let core = match c {
            'ƒ'=>Some(TokenKind::Fn),'≔'=>Some(TokenKind::Let),'↩'=>Some(TokenKind::Return),
            '⊢'=>Some(TokenKind::If),'⊣'=>Some(TokenKind::Else),'⟳'=>Some(TokenKind::While),'⇒'=>Some(TokenKind::Then),
            '→'=>Some(TokenKind::Arrow),'←'=>Some(TokenKind::Assign),
            '⊤'=>Some(TokenKind::True),'⊥'=>Some(TokenKind::False),
            '∧'=>Some(TokenKind::And),'∨'=>Some(TokenKind::Or),'¬'=>Some(TokenKind::Not),
            '≡'=>Some(TokenKind::Equal),'≠'=>Some(TokenKind::NotEqual),
            '≤'=>Some(TokenKind::LessEqual),'≥'=>Some(TokenKind::GreaterEqual),
            '∷'=>Some(TokenKind::DoubleColon),'▷'=>Some(TokenKind::Pipe),'∘'=>Some(TokenKind::Compose),'◇'=>Some(TokenKind::Choice),
            '⟦'=>Some(TokenKind::SeqOpen),'⟧'=>Some(TokenKind::SeqClose),
            '⦃'=>Some(TokenKind::RecOpen),'⦄'=>Some(TokenKind::RecClose),'·'=>Some(TokenKind::Field),'⊞'=>Some(TokenKind::RecordUpdate),
            '⤓'=>Some(TokenKind::JsonRead),'⤔'=>Some(TokenKind::JsonValid),'⤒'=>Some(TokenKind::JsonWrite),
            '⫶'=>Some(TokenKind::TextScalars),'⟟'=>Some(TokenKind::TextWords),'⧉'=>Some(TokenKind::Histogram),
            '≋'=>Some(TokenKind::Markdown),'⧄'=>Some(TokenKind::FileRead),'⧅'=>Some(TokenKind::FileWrite),'⤋'=>Some(TokenKind::HttpGet),'⤊'=>Some(TokenKind::HttpServe),'⌛'=>Some(TokenKind::Sleep),'⧇'=>Some(TokenKind::CsvTyped),
            '⌨'=>Some(TokenKind::StdinText),'⩚'=>Some(TokenKind::ArithEval),
            '⌗'=>Some(TokenKind::SeqLength),'⧺'=>Some(TokenKind::SeqConcat),
            '∑'=>Some(TokenKind::Sum),'⌕'=>Some(TokenKind::Filter),'⇢'=>Some(TokenKind::Map),'λ'=>Some(TokenKind::Lambda),'∀'=>Some(TokenKind::Forall),
            _=>None,
        };
        if let Some(kind)=core { advance(&mut pos,&mut line,&mut column); result.push(Token{kind,span}); continue; }
        let pair = match (c,next) {
            ('-',Some('>'))=>Some(TokenKind::Arrow),
            ('=',Some('>'))=>Some(TokenKind::Then),
            (':',Some(':'))=>Some(TokenKind::DoubleColon),
            ('|',Some('>'))=>Some(TokenKind::Pipe),
            ('<',Some('<'))=>Some(TokenKind::Compose),
            ('<',Some('+'))=>Some(TokenKind::RecordUpdate),
            ('[',Some('['))=>Some(TokenKind::SeqOpen),
            (']',Some(']'))=>Some(TokenKind::SeqClose),
            ('+',Some('+'))=>Some(TokenKind::SeqConcat),
            ('@',Some('+'))=>Some(TokenKind::Sum),
            ('@',Some('?'))=>Some(TokenKind::Filter),
            ('@',Some('>'))=>Some(TokenKind::Map),
            ('=',Some('='))=>Some(TokenKind::Equal),
            ('!',Some('='))=>Some(TokenKind::NotEqual),
            ('<',Some('='))=>Some(TokenKind::LessEqual),
            ('>',Some('='))=>Some(TokenKind::GreaterEqual),
            _=>None,
        };
        if let Some(kind)=pair { advance(&mut pos,&mut line,&mut column); advance(&mut pos,&mut line,&mut column); result.push(Token{kind,span});continue; }
        let single = match c {
            '('=>Some(TokenKind::LeftParen),')'=>Some(TokenKind::RightParen),
            '{'=>Some(TokenKind::LeftBrace),'}'=>Some(TokenKind::RightBrace),'.'=>Some(TokenKind::Field),
            ','=>Some(TokenKind::Comma),';'=>Some(TokenKind::Semicolon),'?'=>Some(TokenKind::Choice),'#'=>Some(TokenKind::SeqLength),
            ':'=>Some(TokenKind::Colon),'='=>Some(TokenKind::Assign),
            '+'=>Some(TokenKind::Plus),'-'=>Some(TokenKind::Minus),
            '*'=>Some(TokenKind::Star),'/'=>Some(TokenKind::Slash),
            '%'=>Some(TokenKind::Percent),'<'=>Some(TokenKind::Less),'>'=>Some(TokenKind::Greater),
            _=>None,
        };
        if let Some(kind)=single { advance(&mut pos,&mut line,&mut column); result.push(Token{kind,span});continue; }
        if c=='|' { return Err(err("Unexpected character '|'; use ▷ or |>".into(),span)); }
        if is_symbol(c) { advance(&mut pos,&mut line,&mut column); result.push(Token{kind:TokenKind::Glyph(c),span});continue; }
        return Err(err(format!("Unexpected character {c:?}"), span));
    }
    result.push(Token{kind:TokenKind::Eof,span:Span::new(line,column)});
    Ok(result)
}
