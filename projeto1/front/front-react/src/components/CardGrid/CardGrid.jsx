import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Spinner
} from "react-bootstrap";
import {
  BsCloudArrowUp,
  BsCloudArrowDown,
  BsFileEarmarkMinus,
  BsFileEarmarkPlus,
  BsArrowLeftSquare
} from "react-icons/bs";
import "./CardGrid.css";

// ------------------------------------------------------------------
// AXIOS INSTANCE (edit baseURL if backend lives elsewhere)
// ------------------------------------------------------------------
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://192.168.15.96:8000"
});

// ------------------------------------------------------------------
// CARD DEFINITIONS (menu)
// ------------------------------------------------------------------
const menuCards = [
  { id: 1, icon: <BsCloudArrowDown />,  title: "DOWNLOAD", description: "Baixe um PDF existente pelo UUID." },
  { id: 2, icon: <BsCloudArrowUp />,    title: "UPLOAD",   description: "Envie um PDF e gere UUID." },
  { id: 3, icon: <BsFileEarmarkPlus />, title: "MERGE",    description: "Mescle dois PDFs em um único arquivo." },
  { id: 4, icon: <BsFileEarmarkMinus />,title: "SPLIT",    description: "Extraia páginas específicas de um PDF." }
];

// ------------------------------------------------------------------
// SHARED UI PARTS
// ------------------------------------------------------------------
const IconCard = ({ icon, title, description, onClick }) => (
  <Card role="button" onClick={onClick} className="h-100 shadow-lg custom-card" style={{ cursor: "pointer" }}>
    <Card.Body>
      <span className="fs-1 text-primary mb-2 d-block">{icon}</span>
      <Card.Title as="h5" className="fw-semibold mb-1">{title}</Card.Title>
      <Card.Text className="small text-secondary mb-0">{description}</Card.Text>
    </Card.Body>
  </Card>
);

const GridMenu = ({ onSelect }) => (
  <Container fluid className="my-2 py-5 px-5">
    <Row xs={1} sm={2} md={3} lg={4} className="g-4">
      {menuCards.map((c) => (
        <Col key={c.id}><IconCard {...c} onClick={() => onSelect(c)} /></Col>
      ))}
    </Row>
  </Container>
);

const BackBtn = ({ onClick }) => (
  <Button variant="link" className="mt-3 p-0 fs-3 text-primary" onClick={onClick} aria-label="Voltar">
    <BsArrowLeftSquare />
  </Button>
);

const Wrapper = ({ card, children, onBack }) => (
  <Container className="py-4">
    <h3 className="fw-bold mb-2">{card.title}</h3>
    <p className="text-secondary mb-4">{card.description}</p>
    {children}
    <BackBtn onClick={onBack} />
  </Container>
);

// ------------------------------------------------------------------
// FORMS (each hitting proper endpoint) 
// ------------------------------------------------------------------
const UploadForm = ({ card, onBack }) => {
  const [file, setFile] = useState(null);
  const [uuid, setUuid] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr(""); setUuid("");
    if (!file) return setErr("Selecione um PDF");
    const fd = new FormData(); fd.append("file", file);
    try {
      setLoading(true);
      const { data } = await api.post("/upload", fd);
      setUuid(data.uuid);
    } catch (e) {
      setErr(e.response?.data?.detail || "Erro no upload");
    } finally { setLoading(false); }
  };

  return (
    <Wrapper card={card} onBack={onBack}>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>PDF</Form.Label>
          <Form.Control type="file" accept="application/pdf" onChange={e=>setFile(e.target.files[0])} />
        </Form.Group>
        <Button variant="primary" type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : "Enviar"}</Button>
      </Form>
      {uuid && <Alert variant="success" className="mt-3">UUID: <code>{uuid}</code></Alert>}
      {err && <Alert variant="danger" className="mt-3">{err}</Alert>}
    </Wrapper>
  );
};

const MergeForm = ({ card, onBack }) => {
  const [file1, setFile1] = useState(null), [file2, setFile2] = useState(null);
  const [uuid, setUuid] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setUuid("");
    if (!file1 || !file2) return setErr("Selecione os dois PDFs");
    const fd = new FormData(); fd.append("file1", file1); fd.append("file2", file2);
    try {
      setLoading(true);
      const { data } = await api.post("/merge", fd);
      setUuid(data.uuid);
    } catch (e) { setErr(e.response?.data?.detail || "Erro ao mesclar"); }
    finally { setLoading(false); }
  };

  return (
    <Wrapper card={card} onBack={onBack}>
      <Form onSubmit={submit}>
        <Form.Group className="mb-3"><Form.Label>PDF 1</Form.Label><Form.Control type="file" accept="application/pdf" onChange={e=>setFile1(e.target.files[0])} /></Form.Group>
        <Form.Group className="mb-3"><Form.Label>PDF 2</Form.Label><Form.Control type="file" accept="application/pdf" onChange={e=>setFile2(e.target.files[0])} /></Form.Group>
        <Button variant="primary" type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : "Mesclar"}</Button>
      </Form>
      {uuid && <Alert variant="success" className="mt-3">UUID: <code>{uuid}</code></Alert>}
      {err && <Alert variant="danger" className="mt-3">{err}</Alert>}
    </Wrapper>
  );
};

const SplitForm = ({ card, onBack }) => {
  const [file, setFile] = useState(null), [range, setRange] = useState("");
  const [uuid, setUuid] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setUuid("");
    if (!file || !range) return setErr("Arquivo e intervalo obrigatórios");
    const fd = new FormData(); fd.append("file", file); fd.append("range", range);
    try {
      setLoading(true);
      const { data } = await api.post("/extract", fd);
      setUuid(data.uuid);
    } catch (e) { setErr(e.response?.data?.detail || "Erro ao extrair"); }
    finally { setLoading(false); }
  };

  return (
    <Wrapper card={card} onBack={onBack}>
      <Form onSubmit={submit}>
        <Form.Group className="mb-3"><Form.Label>PDF</Form.Label><Form.Control type="file" accept="application/pdf" onChange={e=>setFile(e.target.files[0])} /></Form.Group>
        <Form.Group className="mb-3"><Form.Label>Intervalo (ex.: 1-5)</Form.Label><Form.Control type="text" value={range} onChange={e=>setRange(e.target.value)} /></Form.Group>
        <Button variant="primary" type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : "Extrair"}</Button>
      </Form>
      {uuid && <Alert variant="success" className="mt-3">UUID: <code>{uuid}</code></Alert>}
      {err && <Alert variant="danger" className="mt-3">{err}</Alert>}
    </Wrapper>
  );
};

const DownloadForm = ({ card, onBack }) => {
  const [uuid, setUuid] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!uuid) return setErr("Informe o UUID");
    try {
      setLoading(true);
      const resp = await api.get(`/download/${uuid}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${uuid}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.response?.data?.detail || "UUID não encontrado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper card={card} onBack={onBack}>
      <Form onSubmit={submit}>
        <Form.Group className="mb-3">
          <Form.Label>UUID</Form.Label>
          <Form.Control type="text" value={uuid} onChange={(e) => setUuid(e.target.value)} />
        </Form.Group>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Download"}
        </Button>
      </Form>
      {err && <Alert variant="danger" className="mt-3">{err}</Alert>}
    </Wrapper>
  );
};

// -------- mapping + main component -----------------------------------
const formByTitle = { UPLOAD: UploadForm, DOWNLOAD: DownloadForm, MERGE: MergeForm, SPLIT: SplitForm };

export default function GenerateCardGrid({ forcedFormTitle = null, onFormOpenChange }) {
  const [selected, setSelected] = useState(null);

  // sync with external nav
  useEffect(() => {
    if (forcedFormTitle) {
      const card = menuCards.find((c) => c.title === forcedFormTitle);
      if (card) {
        setSelected(card);
        onFormOpenChange?.(true);
      }
    } else {
      if (selected) {
        setSelected(null);
        onFormOpenChange?.(false);
      }
    }
  }, [forcedFormTitle]);

  const openCard = (card) => {
    setSelected(card);
    onFormOpenChange?.(true);
  };
  const back = () => {
    setSelected(null);
    onFormOpenChange?.(false);
  };

  if (selected) {
    const Comp = formByTitle[selected.title];
    return <Comp card={selected} onBack={back} />;
  }

  return <GridMenu onSelect={openCard} />;
};
