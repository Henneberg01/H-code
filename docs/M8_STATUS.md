# H-Code M8 status (2026-10-17)
Rust JS backend now has 100000 fuel ticks and a 1000-call recursion guard.
Studio API validates Origin/Host and JSON Content-Type for POST.
Windows benchmarks: fibonacci 9.01 ms, invoice 9.34 ms, inventory 9.26 ms, savings 9.13 ms medians, 5 trials each.
M1 Node 39/39, Rust 34/34, Studio 13/13 tests pass: total 86/86.
IMPORTANT: Node-generated code is NOT SANDBOXED. Only trusted H-Code.
Missing: OS process tree enforcement, memory budget, atomic multi-file recovery, real provider and visual QA, GitHub sync.
