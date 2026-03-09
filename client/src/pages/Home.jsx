import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

const messages = [
  "Secure • Transparent • Verifiable Voting",
  "Institutional Election Portal",
  "One voter • One vote per position",
  "Tamper-proof records + instant confirmation"
];

export default function Home() {
  const nav = useNavigate();

  const [text, setText] = useState("");
  const [msgIndex, setMsgIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = messages[msgIndex];

    const t = setTimeout(() => {
      if (!deleting) {
        setText(current.slice(0, charIndex + 1));
        setCharIndex(c => c + 1);
        if (charIndex + 1 === current.length) setDeleting(true);
      } else {
        setText(current.slice(0, charIndex - 1));
        setCharIndex(c => c - 1);
        if (charIndex === 0) {
          setDeleting(false);
          setMsgIndex(i => (i + 1) % messages.length);
        }
      }
    }, deleting ? 35 : 55);

    return () => clearTimeout(t);
  }, [charIndex, deleting, msgIndex]);

  return (
    <div className="home">
      <div className="shade" />
      <div className="content">
        <div className="panel">

          <div className="tag">Voting Prototype</div>

          <h1 className="title">Blockchain Election System</h1>

          <p className="subtitle">
            Secure digital voting platform for institutional elections.
          </p>

          <p className="type">{text}<span className="cursor">|</span></p>

          <div className="actions">
            <button className="btn primary" onClick={()=>nav("/login")}>
              Enter Portal
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}