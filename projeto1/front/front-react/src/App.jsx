import React, { useState } from "react";
import CustomNavBar from "./components/NavBar/CustomNavBar.jsx";
import GenerateCardGrid from "./components/CardGrid/CardGrid.jsx";
import { Container } from "react-bootstrap";
import "./App.css";

export default function App() {
  const [formOpen, setFormOpen]     = useState(false);
  const [forceTitle, setForceTitle] = useState(null);

  const handleNavigate = (key) => {
    if (key === "HOME") {
      setForceTitle(null);
      setFormOpen(false);
    } else {
      setForceTitle(key);
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <CustomNavBar onNavigate={handleNavigate} />

      {!formOpen && (
        <Container className="pt-5 text-center">
          <h2 className="fw-bold">Ferramentas online para PDF</h2>
          <p className="text-secondary">
            Ferramenta online e completamente gratuita para juntar PDF,
            dividir PDF, salvar e compartilhar PDF
          </p>
        </Container>
      )}

      <GenerateCardGrid
        forcedFormTitle={forceTitle}
        onFormOpenChange={setFormOpen}
      />

      <footer className="bg-light mt-auto py-3 border-top">
        <Container className="text-center small text-secondary">
          © {new Date().getFullYear()} PDF Tools · Desenvolvido com React & Bootstrap
        </Container>
      </footer>
    </div>
  );
}
