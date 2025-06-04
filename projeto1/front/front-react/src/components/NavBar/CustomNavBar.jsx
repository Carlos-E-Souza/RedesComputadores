import { Container, Nav, Navbar, NavDropdown } from "react-bootstrap";
import { BsFiletypePdf } from "react-icons/bs";
import "./CustomNavBar.css";


export default function CustomNavBar({ onNavigate }) {
  const go = (key) => onNavigate?.(key);

  return (
    <>
      <Navbar
        expand="lg"
        bg="light"
        className="shadow custom-navbar"
      >
        <Container fluid>
          <Navbar.Brand onClick={() => go("HOME")}><BsFiletypePdf/></Navbar.Brand>

          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto mb-2 mb-lg-0">
              <Nav.Link onClick={() => go("HOME")}>Home</Nav.Link>
              <Nav.Link onClick={() => go("UPLOAD")}>Gerar Link</Nav.Link>
              <Nav.Link onClick={() => go("DOWNLOAD")}>Usar Link</Nav.Link>

              <NavDropdown title="Serviços" id="services">
                <NavDropdown.Item onClick={() => go("DOWNLOAD")}>
                  Download
                </NavDropdown.Item>
                <NavDropdown.Item onClick={() => go("UPLOAD")}>
                  Upload
                </NavDropdown.Item>
                <NavDropdown.Item onClick={() => go("MERGE")}>
                  Merge
                </NavDropdown.Item>
                <NavDropdown.Item onClick={() => go("SPLIT")}>
                  Split
                </NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </>
  );
}
