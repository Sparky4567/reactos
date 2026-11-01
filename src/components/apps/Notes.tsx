import { useEffect, useState } from "react";

interface Page { id: string; title: string; content: string; modified: number; }
interface Section { id: string; name: string; pages: Page[]; }
interface Notebook { id: string; name: string; sections: Section[]; }

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT: Notebook[] = [
  {
    id: "nb1", name: "Personal", sections: [
      { id: "s1", name: "Quick Notes", pages: [
        { id: "p1", title: "Welcome", content: "This is your notebook.\nType here to take notes.", modified: Date.now() },
      ]},
    ],
  },
];

function load(): Notebook[] {
  try {
    const raw = localStorage.getItem("reactos.notes");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT;
}

export function Notes() {
  const [notebooks, setNotebooks] = useState<Notebook[]>(load);
  const [nbId, setNbId] = useState<string>(notebooks[0]?.id ?? "");
  const [secId, setSecId] = useState<string>(notebooks[0]?.sections[0]?.id ?? "");
  const [pageId, setPageId] = useState<string>(notebooks[0]?.sections[0]?.pages[0]?.id ?? "");

  useEffect(() => { try { localStorage.setItem("reactos.notes", JSON.stringify(notebooks)); } catch {} }, [notebooks]);

  const notebook = notebooks.find((n) => n.id === nbId) ?? notebooks[0];
  const section = notebook?.sections.find((s) => s.id === secId) ?? notebook?.sections[0];
  const page = section?.pages.find((p) => p.id === pageId) ?? section?.pages[0];

  // keep selection valid
  useEffect(() => {
    if (!notebook && notebooks.length) setNbId(notebooks[0]!.id);
  }, [notebooks, notebook]);
  useEffect(() => {
    if (notebook && !notebook.sections.find((s) => s.id === secId) && notebook.sections.length) setSecId(notebook.sections[0]!.id);
  }, [notebook, secId]);
  useEffect(() => {
    if (section && !section.pages.find((p) => p.id === pageId) && section.pages.length) setPageId(section.pages[0]!.id);
  }, [section, pageId]);

  const updatePage = (patch: Partial<Page>) => {
    if (!notebook || !section || !page) return;
    setNotebooks((nbs) =>
      nbs.map((nb) =>
        nb.id !== notebook.id ? nb : {
          ...nb,
          sections: nb.sections.map((sec) =>
            sec.id !== section.id ? sec : {
              ...sec,
              pages: sec.pages.map((pg) =>
                pg.id !== page.id ? pg : { ...pg, ...patch, modified: Date.now() }
              ),
            }
          ),
        }
      )
    );
  };

  const addNotebook = () => {
    const name = window.prompt("Notebook name", "New Notebook");
    if (!name) return;
    const nb: Notebook = { id: uid(), name, sections: [{ id: uid(), name: "Section 1", pages: [] }] };
    setNotebooks((nbs) => [...nbs, nb]);
    setNbId(nb.id);
    setSecId(nb.sections[0]!.id);
    setPageId("");
  };

  const addSection = () => {
    if (!notebook) return;
    const name = window.prompt("Section name", "New Section");
    if (!name) return;
    const sec: Section = { id: uid(), name, pages: [] };
    setNotebooks((nbs) => nbs.map((nb) => nb.id !== notebook.id ? nb : { ...nb, sections: [...nb.sections, sec] }));
    setSecId(sec.id);
    setPageId("");
  };

  const addPage = () => {
    if (!notebook || !section) return;
    const pg: Page = { id: uid(), title: "Untitled", content: "", modified: Date.now() };
    setNotebooks((nbs) => nbs.map((nb) => nb.id !== notebook.id ? nb : {
      ...nb,
      sections: nb.sections.map((sec) => sec.id !== section.id ? sec : { ...sec, pages: [...sec.pages, pg] }),
    }));
    setPageId(pg.id);
  };

  const deletePage = () => {
    if (!notebook || !section || !page) return;
    setNotebooks((nbs) => nbs.map((nb) => nb.id !== notebook.id ? nb : {
      ...nb,
      sections: nb.sections.map((sec) => sec.id !== section.id ? sec : { ...sec, pages: sec.pages.filter((p) => p.id !== page.id) }),
    }));
    setPageId("");
  };

  return (
    <div className="app-notes">
      <aside className="notes-sidebar">
        <div className="notes-sidebar-header">
          <span>Notebooks</span>
          <button onClick={addNotebook} title="New notebook"><i className="fa fa-plus" /></button>
        </div>
        <ul className="notes-list">
          {notebooks.map((nb) => (
            <li key={nb.id} className={nb.id === nbId ? "active" : ""} onClick={() => { setNbId(nb.id); setSecId(nb.sections[0]?.id ?? ""); setPageId(nb.sections[0]?.pages[0]?.id ?? ""); }}>
              <i className="fa fa-book" /> {nb.name}
            </li>
          ))}
        </ul>
        <div className="notes-sidebar-header">
          <span>Sections</span>
          <button onClick={addSection} title="New section"><i className="fa fa-plus" /></button>
        </div>
        <ul className="notes-list">
          {notebook?.sections.map((sec) => (
            <li key={sec.id} className={sec.id === secId ? "active" : ""} onClick={() => { setSecId(sec.id); setPageId(sec.pages[0]?.id ?? ""); }}>
              <i className="fa fa-folder" /> {sec.name}
            </li>
          )) ?? null}
        </ul>
      </aside>
      <aside className="notes-pages">
        <div className="notes-sidebar-header">
          <span>Pages</span>
          <button onClick={addPage} title="New page"><i className="fa fa-plus" /></button>
        </div>
        <ul className="notes-list">
          {section?.pages.map((pg) => (
            <li key={pg.id} className={pg.id === pageId ? "active" : ""} onClick={() => setPageId(pg.id)}>
              <i className="fa fa-file-text-o" /> {pg.title || "Untitled"}
            </li>
          )) ?? null}
        </ul>
        {page && <button className="notes-delete" onClick={deletePage} title="Delete page"><i className="fa fa-trash" /> Delete</button>}
      </aside>
      <main className="notes-editor">
        {page ? (
          <>
            <input
              className="notes-title"
              value={page.title}
              onChange={(e) => updatePage({ title: e.target.value })}
              placeholder="Page title"
            />
            <textarea
              className="notes-content"
              value={page.content}
              onChange={(e) => updatePage({ content: e.target.value })}
              placeholder="Start typing your note..."
              spellCheck={false}
            />
            <div className="notes-status">Last modified: {new Date(page.modified).toLocaleString()}</div>
          </>
        ) : (
          <div className="notes-empty">Select or create a page to start taking notes.</div>
        )}
      </main>
    </div>
  );
}