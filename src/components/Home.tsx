import { useRef, useState } from 'react';
import { useStore } from '../store';
import { createProject, duplicateProject, importSdtn, openProject, removeProject, updateProjectInfo } from '../projects';
import type { Summary } from '../persist';

const when = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Card({ p }: { p: Summary }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [season, setSeason] = useState(p.season);
  const [confirm, setConfirm] = useState(false);
  const commit = () => {
    setEditing(false);
    if (name.trim() && (name !== p.name || season !== p.season)) void updateProjectInfo(p.id, { name: name.trim(), season: season.trim() || p.season });
  };
  return (
    <article className="pcard" data-testid="project-card">
      <button className="pthumb" onClick={() => void openProject(p.id)} aria-label={`Open ${p.name}`}>
        {p.thumb ? <img src={p.thumb} alt="" /> : <span className="mono muted small">No preview yet</span>}
      </button>
      <div className="pbody">
        {editing ? (
          <div className="pedit">
            <input aria-label="Project name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} />
            <input aria-label="Season" className="mono" value={season} onChange={(e) => setSeason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} />
            <button className="btn mini" onClick={commit}>
              Save
            </button>
          </div>
        ) : (
          <>
            <h3 className="pname">{p.name}</h3>
            <p className="muted small mono">
              {p.season} / {p.looks} {p.looks === 1 ? 'look' : 'looks'} / {when(p.updated)}
            </p>
          </>
        )}
        <div className="pacts">
          <button className="btn mini" onClick={() => void openProject(p.id)}>
            Open
          </button>
          <button className="btn mini" onClick={() => setEditing(true)}>
            Rename
          </button>
          <button className="btn mini" onClick={() => void duplicateProject(p.id)}>
            Duplicate
          </button>
          {confirm ? (
            <button className="btn mini danger" onClick={() => void removeProject(p.id)}>
              Confirm delete
            </button>
          ) : (
            <button className="btn mini" onClick={() => setConfirm(true)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function Home() {
  const projects = useStore((s) => s.projects);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('FW27');
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const sorted = [...projects].sort((a, b) => b.updated - a.updated);
  return (
    <div className="home" data-testid="home">
      <div className="homehead">
        <span className="logo">SDTN</span>
        <span className="mono muted small">Studio / Projects</span>
      </div>
      <form
        className="newproj"
        onSubmit={(e) => {
          e.preventDefault();
          void createProject(name, season);
          setName('');
        }}
      >
        <input aria-label="New project name" placeholder="Collection name" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="New project season" className="mono" placeholder="FW27" value={season} onChange={(e) => setSeason(e.target.value)} />
        <button className="primary" type="submit">
          New project
        </button>
        <button className="btn mini" type="button" onClick={() => file.current?.click()}>
          Import .sdtn
        </button>
        <input
          ref={file}
          type="file"
          accept=".sdtn,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f && !(await importSdtn(f))) setErr('That file is not an SDTN backup.');
            else setErr('');
          }}
        />
      </form>
      {err && <p className="muted small">{err}</p>}
      {sorted.length === 0 ? (
        <p className="muted">No projects yet. Name a collection above to start.</p>
      ) : (
        <div className="pgrid">
          {sorted.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
