import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api, { errMsg } from './api.js';
import { useAuth } from './App.jsx';

const TYPES = ['house', 'apartment', 'villa', 'cabin', 'room'];
const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const date = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);
const img = (p) => p?.images?.[0] || null;
const Cover = ({ p }) => img(p) ? <img src={img(p)} alt={p.title} /> : <div className="ph">No photo</div>;
const Msg = ({ m }) => m ? <p className={`msg ${m.ok ? 'ok' : 'err'}`} role="status">{m.text}</p> : null;

/* ---------- Home: search + filters ---------- */
export function Home() {
  const [f, setF] = useState({ location: '', type: '', minPrice: '', maxPrice: '', guests: '', checkIn: '', checkOut: '' });
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const search = async (e) => {
    e?.preventDefault();
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
      setList((await api.get('/properties', { params })).data);
    } catch (err) { setError(errMsg(err)); }
  };
  useEffect(() => { search(); }, []);

  return (<>
    <section className="hero">
      <h1>Find a place that feels like yours for a few nights</h1>
      <form className="search" onSubmit={search}>
        <label>Where<input placeholder="City or area" value={f.location} onChange={set('location')} /></label>
        <label>Check in<input type="date" min={today()} value={f.checkIn} onChange={set('checkIn')} /></label>
        <label>Check out<input type="date" min={f.checkIn || today()} value={f.checkOut} onChange={set('checkOut')} /></label>
        <label>Guests<input type="number" min="1" value={f.guests} onChange={set('guests')} /></label>
        <button className="btn">Search</button>
      </form>
      <div className="filters">
        <select value={f.type} onChange={set('type')} aria-label="Property type">
          <option value="">Any type</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input type="number" placeholder="Min price" value={f.minPrice} onChange={set('minPrice')} aria-label="Minimum price" />
        <input type="number" placeholder="Max price" value={f.maxPrice} onChange={set('maxPrice')} aria-label="Maximum price" />
        <button type="button" className="btn ghost" onClick={search}>Apply filters</button>
      </div>
    </section>
    <Msg m={error && { text: error }} />
    {!list ? <p className="empty">Loading places…</p> : list.length === 0 ?
      <p className="empty">No places match. Try a different location or wider dates and prices.</p> :
      <div className="grid">{list.map((p) => (
        <Link key={p._id} to={`/property/${p._id}`} className="card">
          <Cover p={p} />
          <div className="info"><b>{p.title}</b><span>{p.location} · {p.type}</span><span><b>{money(p.pricePerNight)}</b> / night</span></div>
        </Link>))}
      </div>}
  </>);
}

/* ---------- Property detail + booking ---------- */
export function Property() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [b, setB] = useState({ checkIn: '', checkOut: '', guests: 1 });
  const [msg, setMsg] = useState(null);
  const load = () => api.get(`/properties/${id}`).then((r) => setP(r.data)).catch((e) => setMsg({ text: errMsg(e) }));
  useEffect(() => { load(); }, [id]);
  if (!p) return <><Msg m={msg} /><p className="empty">Loading…</p></>;

  const nights = b.checkIn && b.checkOut ? Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / 864e5) : 0;
  const clash = nights > 0 && p.booked.some((x) => new Date(x.checkIn) < new Date(b.checkOut) && new Date(x.checkOut) > new Date(b.checkIn));

  const book = async () => {
    if (!user) return nav('/login');
    try {
      await api.post('/bookings', { property: id, ...b });
      setMsg({ ok: true, text: 'Booking confirmed. Find it in your dashboard.' }); load();
    } catch (e) { setMsg({ text: errMsg(e) }); }
  };

  return (
    <div className="detail">
      <div className="gallery">{p.images.length ? p.images.map((s) => <img key={s} src={s} alt="" />) : <div className="ph big">No photos yet</div>}</div>
      <div className="cols">
        <div>
          <h1>{p.title}</h1>
          <p className="muted">{p.location} · {p.type} · up to {p.guests} guests · hosted by {p.owner?.name}</p>
          <p>{p.description || 'The host has not added a description yet.'}</p>
          {p.booked.length > 0 && <><h3>Already booked</h3>
            <ul>{p.booked.map((x, i) => <li key={i}>{date(x.checkIn)} to {date(x.checkOut)}</li>)}</ul></>}
        </div>
        <aside className="book">
          <p><b className="price">{money(p.pricePerNight)}</b> / night</p>
          <label>Check in<input type="date" min={today()} value={b.checkIn} onChange={(e) => setB({ ...b, checkIn: e.target.value })} /></label>
          <label>Check out<input type="date" min={b.checkIn || today()} value={b.checkOut} onChange={(e) => setB({ ...b, checkOut: e.target.value })} /></label>
          <label>Guests<input type="number" min="1" max={p.guests} value={b.guests} onChange={(e) => setB({ ...b, guests: +e.target.value })} /></label>
          {nights > 0 && (clash
            ? <p className="msg err">Those dates are taken. Pick other dates.</p>
            : <p className="total">{nights} night{nights > 1 && 's'} · <b>{money(nights * p.pricePerNight)}</b></p>)}
          <button className="btn" disabled={!nights || clash} onClick={book}>{user ? 'Book now' : 'Log in to book'}</button>
          <Msg m={msg} />
        </aside>
      </div>
    </div>
  );
}

/* ---------- Login / Register ---------- */
export function Auth({ mode }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState(null);
  const reg = mode === 'register';
  const submit = async (e) => {
    e.preventDefault();
    try { login((await api.post(`/auth/${mode}`, f)).data); nav('/dashboard'); }
    catch (err) { setMsg({ text: errMsg(err) }); }
  };
  return (
    <form className="panel narrow" onSubmit={submit}>
      <h1>{reg ? 'Create your account' : 'Welcome back'}</h1>
      {reg && <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>}
      <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label>Password<input type="password" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
      <button className="btn">{reg ? 'Sign up' : 'Log in'}</button>
      <Msg m={msg} />
      <p className="muted">{reg ? <>Have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/register">Sign up</Link></>}</p>
    </form>
  );
}

/* ---------- Dashboard: listings + bookings ---------- */
export function Dashboard() {
  const { user } = useAuth();
  const [mine, setMine] = useState([]);
  const [trips, setTrips] = useState([]);
  const [received, setReceived] = useState([]);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => Promise.all([api.get('/properties/mine'), api.get('/bookings/mine'), api.get('/bookings/received')])
    .then(([a, b, c]) => { setMine(a.data); setTrips(b.data); setReceived(c.data); })
    .catch((e) => setMsg({ text: errMsg(e) }));
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm('Delete this listing and its bookings?')) return;
    try { await api.delete(`/properties/${id}`); setMsg({ ok: true, text: 'Listing deleted' }); load(); } catch (e) { setMsg({ text: errMsg(e) }); }
  };
  const cancel = async (id) => {
    try { await api.patch(`/bookings/${id}/cancel`); setMsg({ ok: true, text: 'Booking cancelled' }); load(); } catch (e) { setMsg({ text: errMsg(e) }); }
  };

  return (
    <div className="dash">
      <h1>Hi, {user.name}</h1>
      <Msg m={msg} />
      <section className="panel">
        <h2>{editing ? 'Edit listing' : 'Add a listing'}</h2>
        <ListingForm key={editing?._id || 'new'} initial={editing}
          onDone={(m) => { setEditing(null); setMsg(m); load(); }} onCancel={() => setEditing(null)} />
      </section>
      <section>
        <h2>My listings</h2>
        {mine.length === 0 ? <p className="empty">You have no listings yet. Add your first one above.</p> :
          <div className="rows">{mine.map((p) => (
            <div className="row" key={p._id}>
              <Cover p={p} />
              <div><Link to={`/property/${p._id}`}><b>{p.title}</b></Link><br /><span className="muted">{p.location} · {money(p.pricePerNight)} / night</span></div>
              <div className="acts"><button className="btn ghost small" onClick={() => { setEditing(p); window.scrollTo(0, 0); }}>Edit</button>
                <button className="btn danger small" onClick={() => del(p._id)}>Delete</button></div>
            </div>))}</div>}
      </section>
      <section>
        <h2>My trips</h2>
        {trips.length === 0 ? <p className="empty">No trips yet. <Link to="/">Find a place to stay</Link>.</p> :
          <div className="rows">{trips.map((b) => (
            <div className="row" key={b._id}>
              <Cover p={b.property} />
              <div><b>{b.property?.title || 'Removed listing'}</b><br /><span className="muted">{date(b.checkIn)} to {date(b.checkOut)} · {money(b.totalPrice)} · {b.status}</span></div>
              {b.status === 'confirmed' && new Date(b.checkIn) > new Date() &&
                <div className="acts"><button className="btn danger small" onClick={() => cancel(b._id)}>Cancel booking</button></div>}
            </div>))}</div>}
      </section>
      <section>
        <h2>Bookings at my places</h2>
        {received.length === 0 ? <p className="empty">Nobody has booked your places yet.</p> :
          <ul>{received.map((b) => <li key={b._id}>{b.guest?.name} booked <b>{b.property?.title}</b>, {date(b.checkIn)} to {date(b.checkOut)} ({b.status})</li>)}</ul>}
      </section>
    </div>
  );
}

function ListingForm({ initial, onDone, onCancel }) {
  const [f, setF] = useState({ title: '', description: '', location: '', type: 'house', pricePerNight: '', guests: 2, ...initial });
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    ['title', 'description', 'location', 'type', 'pricePerNight', 'guests'].forEach((k) => fd.append(k, f[k] ?? ''));
    [...files].forEach((x) => fd.append('images', x));
    try {
      initial ? await api.put(`/properties/${initial._id}`, fd) : await api.post('/properties', fd);
      onDone({ ok: true, text: initial ? 'Listing saved' : 'Listing published' });
    } catch (err) { setMsg({ text: errMsg(err) }); }
  };
  return (
    <form className="formgrid" onSubmit={submit}>
      <label>Title<input required value={f.title} onChange={set('title')} /></label>
      <label>Location<input required value={f.location} onChange={set('location')} /></label>
      <label>Type<select value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>Price per night (₹)<input type="number" min="1" required value={f.pricePerNight} onChange={set('pricePerNight')} /></label>
      <label>Max guests<input type="number" min="1" value={f.guests} onChange={set('guests')} /></label>
      <label>Photos (up to 6)<input type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} /></label>
      <label className="wide">Description<textarea rows="3" value={f.description} onChange={set('description')} /></label>
      <div className="wide acts"><button className="btn">{initial ? 'Save changes' : 'Publish listing'}</button>
        {initial && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}</div>
      <Msg m={msg} />
    </form>
  );
}
