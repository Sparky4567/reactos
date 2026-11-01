import { useState } from "react";

export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const inputDigit = (d: string) => {
    if (fresh) {
      setDisplay(d === "." ? "0." : d);
      setFresh(false);
    } else {
      if (d === "." && display.includes(".")) return;
      setDisplay(display === "0" && d !== "." ? d : display + d);
    }
  };

  const chooseOp = (nextOp: string) => {
    const val = parseFloat(display);
    if (prev === null) setPrev(val);
    else if (op) {
      const res = compute(prev, val, op);
      setPrev(res);
      setDisplay(String(res));
    }
    setOp(nextOp);
    setFresh(true);
  };

  const compute = (a: number, b: number, o: string) => {
    switch (o) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const equals = () => {
    if (op === null || prev === null) return;
    const val = parseFloat(display);
    const res = compute(prev, val, op);
    setDisplay(String(res));
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const clear = () => {
    setDisplay("0");
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const toggleSign = () => setDisplay(String(parseFloat(display) * -1));
  const percent = () => setDisplay(String(parseFloat(display) / 100));

  const buttons = [
    ["%", "CE", "C", "⌫"],
    ["1/x", "x²", "√", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["+/-", "0", ".", "="],
  ];

  const handle = (b: string) => {
    if (b === "C" || b === "CE") clear();
    else if (b === "⌫") setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
    else if (b === "=") equals();
    else if (["+", "-", "×", "÷"].includes(b)) chooseOp(b);
    else if (b === "+/-") toggleSign();
    else if (b === "%") percent();
    else if (b === "1/x") setDisplay(String(1 / parseFloat(display)));
    else if (b === "x²") setDisplay(String(parseFloat(display) ** 2));
    else if (b === "√") setDisplay(String(Math.sqrt(parseFloat(display))));
    else inputDigit(b);
  };

  return (
    <div className="app-calculator">
      <div className="calc-display">
        <div className="calc-expr">{prev !== null ? `${prev} ${op ?? ""}` : ""}</div>
        <div className="calc-value">{display}</div>
      </div>
      <div className="calc-pad">
        {buttons.map((row, i) => (
          <div className="calc-row" key={i}>
            {row.map((b) => (
              <button
                key={b}
                className={`calc-btn ${["+", "-", "×", "÷", "="].includes(b) ? "op" : ""} ${b === "=" ? "equals" : ""}`}
                onClick={() => handle(b)}
              >
                {b}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
