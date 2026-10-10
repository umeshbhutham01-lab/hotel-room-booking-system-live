import { useEffect, useMemo, useRef, useState } from "react";
import roomCatalog from "./roomCatalog.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const today = new Date().toISOString().slice(0, 10);
const loadUser = () => { try { return JSON.parse(localStorage.getItem("haven_user") || "null"); } catch { return null; } };
const loadToken = () => localStorage.getItem("haven_token") || "";
const loadDemoBookings = () => {
  try { return JSON.parse(localStorage.getItem("haven_demo_bookings") || "[]"); }
  catch { return []; }
};

async function api(path, options = {}) {
  const token = loadToken();
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

export default function App() {
  const rooms = roomCatalog;
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [demoPaymentOpen, setDemoPaymentOpen] = useState(false);
  const [demoBookings, setDemoBookings] = useState(loadDemoBookings);
  const [notice, setNotice] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [form, setForm] = useState({ guestName: "", email: "", checkIn: "", checkOut: "", guests: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(loadUser);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [panel, setPanel] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [myBookings, setMyBookings] = useState([]);
  const [ratingBusy, setRatingBusy] = useState("");
  const [adminSummary, setAdminSummary] = useState(null);
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminRoomForm, setAdminRoomForm] = useState({ name: "", type: "Standard", description: "", pricePerNight: "2499", capacity: "2", image: "", amenities: "Wi-Fi, Air conditioning" });

  useEffect(() => {
    if (panel === "bookings" || panel === "demo-bookings") {
      document.getElementById("account-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [panel]);
  useEffect(() => {
    if (!profileOpen) return undefined;
    function closeOnOutsideClick(event) {
      if (!profileMenuRef.current?.contains(event.target)) setProfileOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);
  const visibleRooms = useMemo(() => rooms.filter((r) => filter === "All" || r.type === filter), [rooms, filter]);
  const nights = form.checkIn && form.checkOut && new Date(form.checkOut) > new Date(form.checkIn)
    ? Math.ceil((new Date(form.checkOut) - new Date(form.checkIn)) / 86400000) : 0;

  function update(key, value) {
    setBookingError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function signOut() {
    localStorage.removeItem("haven_token"); localStorage.removeItem("haven_user");
    setUser(null); setPanel(""); setMyBookings([]); setAdminSummary(null); setAdminBookings([]);
    setNotice("You have signed out.");
  }
  function printReceipt(booking) {
    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) {
      setNotice("Allow pop-ups to open your booking receipt.");
      return;
    }
    const date = (value) => new Date(value).toLocaleDateString("en-IN", { dateStyle: "long" });
    const rows = [
      ["Receipt number", booking._id],
      ["Guest", booking.guestName],
      ["Email", booking.email],
      ["Room", booking.room?.name || "Room unavailable"],
      ["Guests", booking.guests],
      ["Check-in", date(booking.checkIn)],
      ["Check-out", date(booking.checkOut)],
      ["Payment", booking.paymentStatus],
      ["Payment ID", booking.razorpayPaymentId],
      ["Total paid", money(booking.totalPrice)]
    ].map(([label, value]) => `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

    receiptWindow.document.write(`<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Booking receipt ${escapeHtml(booking._id)}</title>
      <style>
        body{margin:0;padding:40px;background:#f5f1e8;color:#1b352f;font:15px Arial,sans-serif}
        main{max-width:620px;margin:0 auto;padding:40px;background:#fffdf8;border:1px solid #e5ddcf}
        h1{margin:0 0 8px;font:500 32px Georgia,serif}p{color:#65756d}
        .rows{margin:30px 0}.row{display:flex;justify-content:space-between;gap:24px;padding:13px 0;border-bottom:1px solid #e5ddcf}
        .row span{color:#65756d}.row strong{text-align:right;overflow-wrap:anywhere}
        button{padding:12px 18px;border:0;background:#173a32;color:white;font-weight:bold;cursor:pointer}
        @media print{body{padding:0;background:white}main{border:0;padding:20px;max-width:none}button{display:none}}
      </style></head><body><main><h1>Hotel Rooms</h1><p>Booking payment receipt</p>
      <div class="rows">${rows}</div><button onclick="window.print()">Print receipt</button></main></body></html>`);
    receiptWindow.document.close();
  }
  async function authenticate(e) {
    e.preventDefault(); setAuthBusy(true); setNotice("");
    try {
      const path = authMode === "register" ? "/auth/register" : "/auth/login";
      const result = await api(path, { method: "POST", body: JSON.stringify(authForm) });
      localStorage.setItem("haven_token", result.token);
      localStorage.setItem("haven_user", JSON.stringify(result.user));
      setUser(result.user); setAuthOpen(false); setAuthForm({ name: "", email: "", password: "" });
      setNotice(`Welcome${result.user.name ? `, ${result.user.name}` : ""}!`);
      if (selected) setForm((prev) => ({ ...prev, guestName: result.user.name, email: result.user.email }));
    } catch (e) { setNotice(e.message); }
    finally { setAuthBusy(false); }
  }

  async function book(event) {
    event.preventDefault();
    if (!selected) return;
    setNotice(""); setBookingError(""); setSubmitting(true);
    try {
      if (!form.checkIn || !form.checkOut || new Date(form.checkOut) <= new Date(form.checkIn)) {
        throw new Error("Choose a check-out date after your check-in date.");
      }
      setDemoPaymentOpen(true);
    } catch (e) { setBookingError(e.message); }
    finally { setSubmitting(false); }
  }

  function completeDemoPayment() {
    if (!selected) return;
    const booking = {
      _id: `DEMO-${Date.now()}`,
      room: selected,
      guestName: form.guestName.trim(),
      email: form.email.trim(),
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      guests: Number(form.guests),
      totalPrice: nights * selected.pricePerNight,
      status: "confirmed",
      paymentStatus: "demo_paid",
      createdAt: new Date().toISOString()
    };
    const nextBookings = [booking, ...demoBookings];
    try {
      localStorage.setItem("haven_demo_bookings", JSON.stringify(nextBookings));
      setDemoBookings(nextBookings);
      setNotice("Demo booking confirmed. No real payment was taken.");
      setSelected(null);
      setDemoPaymentOpen(false);
      setForm({ guestName: "", email: "", checkIn: "", checkOut: "", guests: 1 });
      setPanel("demo-bookings");
    } catch {
      setBookingError("Could not save the demo booking in this browser. Check your available storage and try again.");
    }
  }

  async function fetchMyBookings() {
    try { setMyBookings(await api("/bookings/mine")); setPanel("bookings"); }
    catch (e) { setNotice(e.message); }
  }
  async function cancelBooking(id) {
    if (!window.confirm("Cancel this unpaid/pending booking? Paid bookings require the hotel to process a refund.")) return;
    try {
      const result = await api(`/bookings/${id}/cancel`, { method: "POST", body: JSON.stringify({}) });
      setNotice(result.message); await fetchMyBookings();
      if (user?.role === "admin") await fetchAdmin();
    } catch (e) { setNotice(e.message); }
  }
  async function rateBooking(bookingId, rating) {
    setRatingBusy(bookingId);
    try {
      const result = await api(`/bookings/${bookingId}/rating`, {
        method: "POST",
        body: JSON.stringify({ rating })
      });
      setNotice(result.message);
      await fetchMyBookings();
    } catch (e) { setNotice(e.message); }
    finally { setRatingBusy(""); }
  }
  async function fetchAdmin() {
    try {
      const [summary, bookings] = await Promise.all([api("/admin/summary"), api("/bookings")]);
      setAdminSummary(summary); setAdminBookings(bookings); setPanel("admin");
    } catch (e) { setNotice(e.message); }
  }
  async function addRoom(e) {
    e.preventDefault();
    try {
      const payload = { ...adminRoomForm, pricePerNight: Number(adminRoomForm.pricePerNight), capacity: Number(adminRoomForm.capacity), amenities: adminRoomForm.amenities.split(",").map(s => s.trim()).filter(Boolean) };
      await api("/admin/rooms", { method: "POST", body: JSON.stringify(payload) });
      setNotice("Room added successfully."); setAdminRoomForm({ name: "", type: "Standard", description: "", pricePerNight: "2499", capacity: "2", image: "", amenities: "Wi-Fi, Air conditioning" });
      await fetchAdmin();
    } catch (e) { setNotice(e.message); }
  }
  async function deleteRoom(id) {
    if (!window.confirm("Delete this room? Rooms with active bookings cannot be deleted.")) return;
    try { await api(`/admin/rooms/${id}`, { method: "DELETE" }); setNotice("Room deleted."); await fetchAdmin(); }
    catch (e) { setNotice(e.message); }
  }

  return <div className="app">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">H</span><span>Hotel Rooms</span></a>
      <nav><a href="#rooms">Our rooms</a><a href="#experience">The experience</a><a href="#help">Help</a><a href="#contact">Contact us</a></nav>
      <div className="header-actions">
        <button className="text-action" onClick={() => setPanel("demo-bookings")}>Demo bookings ({demoBookings.length})</button>
        {user ? <>
          {user.role === "admin" && <button className="text-action" onClick={fetchAdmin}>Admin</button>}
          <div className="profile-menu" ref={profileMenuRef}>
            <button className="profile-trigger" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
              <span className="profile-avatar" aria-hidden="true">{(user.name || user.email || "U").trim().charAt(0).toUpperCase()}</span>
              <span className="profile-trigger-name">{user.name || "My profile"}</span>
              <span className="profile-chevron" aria-hidden="true">{profileOpen ? "⌃" : "⌄"}</span>
            </button>
            {profileOpen && <div className="profile-dropdown" role="menu">
              <div className="profile-summary">
                <span className="profile-avatar large" aria-hidden="true">{(user.name || user.email || "U").trim().charAt(0).toUpperCase()}</span>
                <div><strong>{user.name || "Guest"}</strong><span>{user.email}</span><small>{user.role === "admin" ? "Administrator" : "Guest account"}</small></div>
              </div>
              <button role="menuitem" onClick={() => { setProfileOpen(false); fetchMyBookings(); }}>My bookings</button>
              <button role="menuitem" onClick={() => { setProfileOpen(false); signOut(); }}>Sign out</button>
            </div>}
          </div>
        </> : <button className="nav-cta" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Sign in <span>↗</span></button>}
      </div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-shade"></div>
        <div className="hero-content">
          <div className="eyebrow"><span></span> A STAY THAT STAYS WITH YOU</div>
          <h1>Make room<br />for <em>something</em><br />wonderful.</h1>
          <p>Thoughtful spaces, warm hospitality, and little details that turn a trip into a memory.</p>
          <a className="primary-btn" href="#rooms">Explore our rooms <span>↓</span></a>
        </div>
        <div className="hero-foot"><span>01 — YOUR NEXT CHAPTER</span><span>COMFORT, CONSIDERED.</span></div>
        <div className="hero-badge"><span>✳</span><small>STAY A LITTLE<br />DIFFERENT</small></div>
      </section>

      <section className="intro" id="experience">
        <div className="eyebrow dark"><span></span> MORE THAN A PLACE TO SLEEP</div>
        <div className="intro-grid"><h2>Good stays.<br /><em>Great stories.</em></h2><p>From slow mornings to late-night conversations, we believe the best journeys deserve a beautiful place to pause. Find your kind of comfort at Haven.</p></div>
        <div className="perks">
          <div><span className="perk-icon">✧</span><b>Considered comfort</b><small>Little luxuries, made for you.</small></div>
          <div><span className="perk-icon">⌁</span><b>Easy by design</b><small>Simple booking, seamless stays.</small></div>
          <div><span className="perk-icon">♡</span><b>Warm hospitality</b><small>Feel at home, wherever you are.</small></div>
        </div>
      </section>

      <section className="rooms-section" id="rooms">
        <div className="section-heading"><div><div className="eyebrow dark"><span></span> FIND YOUR HAVEN</div><h2>Rooms with <em>room</em><br />for you.</h2></div><p>Every room has its own character.<br />All of them feel like a welcome.</p></div>
        <div className="filters" aria-label="Filter rooms">
          {["All", "Standard", "Deluxe", "Suite"].map((type) => <button key={type} className={filter === type ? "filter active" : "filter"} onClick={() => setFilter(type)}>{type}</button>)}
          <span className="room-count">{visibleRooms.length} SPACES TO DISCOVER</span>
        </div>
        {notice && <div className="message success">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
        <div className="message">Demo rooms and checkout only. No real reservation or payment is created.</div>
        <div className="room-grid">
          {visibleRooms.map((room, index) => <article className="room-card" key={room._id}>
            <div className="room-image-wrap"><img src={room.image || "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80"} alt={room.name} /><span className="room-type">{room.type}</span><span className="room-index">0{index + 1}</span></div>
            <div className="room-info"><div className="room-title-row"><h3>{room.name}</h3><span className="capacity">♧ {room.capacity}</span></div><p>{room.description}</p><div className="room-rating" aria-label={room.ratingCount ? `${room.ratingAverage} out of 5 stars, ${room.ratingCount} ratings` : "No ratings yet"}><span className={room.ratingCount ? "room-rating-stars has-rating" : "room-rating-stars"} aria-hidden="true">{[1, 2, 3, 4, 5].map((star) => <span key={star} className={room.ratingAverage >= star ? "filled" : ""}>★</span>)}</span>{room.ratingCount ? <span>{room.ratingAverage} · {room.ratingCount} {room.ratingCount === 1 ? "rating" : "ratings"}</span> : <span>No ratings yet</span>}</div><div className="amenities">{(room.amenities || []).slice(0, 3).map((a) => <span key={a}>{a}</span>)}</div>
              <div className="room-bottom"><div><strong>{money(room.pricePerNight)}</strong><small> / night</small></div><button className="book-btn" onClick={() => { setSelected(room); setDemoPaymentOpen(false); setNotice(""); setBookingError(""); setForm((prev) => ({ ...prev, guestName: user?.name || "", email: user?.email || "", guests: 1 })); }}>Demo book this room <span>↗</span></button></div>
            </div>
          </article>)}
          {!visibleRooms.length && <p className="empty">No rooms in this category yet. Try another filter.</p>}
        </div>
      </section>

      {panel === "bookings" && <section className="dashboard-section" id="account-panel">
        <div className="dashboard-title"><div><div className="eyebrow dark"><span></span> YOUR ACCOUNT</div><h2>My <em>bookings.</em></h2></div><button className="filter" onClick={() => setPanel("")}>Close</button></div>
        {!myBookings.length ? <p className="empty">You have no bookings yet.</p> : <div className="my-bookings-list">{myBookings.map(b => <article className="my-booking-card" key={b._id}>
          <div className="my-booking-heading">
            <div><div className="eyebrow dark"><span></span> BOOKING DETAILS</div><h3>{b.room?.name || "Room unavailable"}</h3><small>Booking reference · {b._id}</small></div>
            <span className={`status ${b.status}`}>{b.status.replace("_", " ")}</span>
          </div>
          <div className="my-booking-details">
            <div><small>Guest</small><strong>{b.guestName}</strong><span>{b.email}</span></div>
            <div><small>Check-in</small><strong>{new Date(b.checkIn).toLocaleDateString("en-IN", { dateStyle: "medium" })}</strong></div>
            <div><small>Check-out</small><strong>{new Date(b.checkOut).toLocaleDateString("en-IN", { dateStyle: "medium" })}</strong></div>
            <div><small>Guests</small><strong>{b.guests}</strong></div>
            <div><small>Payment status</small><strong>{b.paymentStatus}</strong>{b.razorpayPaymentId && <span>Payment ID · {b.razorpayPaymentId}</span>}</div>
          </div>
          <div className="my-booking-footer"><div><small>Total</small><strong>{money(b.totalPrice)}</strong></div><div className="my-booking-actions">
            {b.status === "confirmed" && b.paymentStatus === "paid" && <div className="booking-rating" aria-label={b.rating ? `Your rating: ${b.rating} out of 5 stars` : "Rate this room"}>
              <small>{b.rating ? `Your rating: ${b.rating}/5` : "Rate this room"}</small>
              <div className="rating-buttons">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={b.rating >= rating ? "rating-star selected" : "rating-star"} aria-label={`Rate ${rating} out of 5 stars`} aria-pressed={b.rating === rating} disabled={ratingBusy === b._id} onClick={() => rateBooking(b._id, rating)}>★</button>)}</div>
            </div>}
            {b.paymentStatus === "paid" && <button className="mini-btn" onClick={() => printReceipt(b)}>View receipt</button>}
            {b.status !== "cancelled" && b.paymentStatus !== "paid" && <button className="mini-btn" onClick={() => cancelBooking(b._id)}>Cancel booking</button>}
          </div></div>
        </article>)}</div>}
      </section>}

      {panel === "demo-bookings" && <section className="dashboard-section" id="account-panel">
        <div className="dashboard-title"><div><div className="eyebrow dark"><span></span> SAVED IN THIS BROWSER</div><h2>Demo <em>bookings.</em></h2></div><button className="filter" onClick={() => setPanel("")}>Close</button></div>
        <p className="message">These are test bookings stored only on this device. Demo payments do not charge money and are not sent to the hotel.</p>
        {!demoBookings.length ? <p className="empty">No demo bookings yet. Choose a room to try the demo checkout.</p> : <div className="my-bookings-list">{demoBookings.map((booking) => <article className="my-booking-card" key={booking._id}>
          <div className="my-booking-heading">
            <div><div className="eyebrow dark"><span></span> DEMO BOOKING</div><h3>{booking.room.name}</h3><small>Reference · {booking._id}</small></div>
            <span className="status confirmed">confirmed · demo</span>
          </div>
          <div className="my-booking-details">
            <div><small>Guest</small><strong>{booking.guestName}</strong><span>{booking.email}</span></div>
            <div><small>Check-in</small><strong>{new Date(booking.checkIn).toLocaleDateString("en-IN", { dateStyle: "medium" })}</strong></div>
            <div><small>Check-out</small><strong>{new Date(booking.checkOut).toLocaleDateString("en-IN", { dateStyle: "medium" })}</strong></div>
            <div><small>Guests</small><strong>{booking.guests}</strong></div>
            <div><small>Payment</small><strong>Simulated — no charge</strong></div>
          </div>
          <div className="my-booking-footer"><div><small>Demo total</small><strong>{money(booking.totalPrice)}</strong></div></div>
        </article>)}</div>}
      </section>}

      {panel === "admin" && user?.role === "admin" && <section className="dashboard-section" id="admin-panel">
        <div className="dashboard-title"><div><div className="eyebrow dark"><span></span> HAVEN MANAGEMENT</div><h2>Admin <em>dashboard.</em></h2></div><button className="filter" onClick={() => setPanel("")}>Close</button></div>
        <div className="stats-grid">{[["Rooms", adminSummary?.rooms],["Bookings", adminSummary?.bookings],["Confirmed",adminSummary?.confirmed],["Users",adminSummary?.users],["Paid revenue",money(adminSummary?.paidRevenue)]].map(([label,value])=><div className="stat-card" key={label}><small>{label}</small><strong>{value ?? "—"}</strong></div>)}</div>
        <div className="admin-columns">
          <div><h3>Add a room</h3><form className="admin-form" onSubmit={addRoom}>
            <label>Room name<input required value={adminRoomForm.name} onChange={e=>setAdminRoomForm({...adminRoomForm,name:e.target.value})}/></label>
            <label>Type<select value={adminRoomForm.type} onChange={e=>setAdminRoomForm({...adminRoomForm,type:e.target.value})}><option>Standard</option><option>Deluxe</option><option>Suite</option></select></label>
            <label>Description<input value={adminRoomForm.description} onChange={e=>setAdminRoomForm({...adminRoomForm,description:e.target.value})}/></label>
            <div className="form-row"><label>Price/night (₹)<input required type="number" min="0" value={adminRoomForm.pricePerNight} onChange={e=>setAdminRoomForm({...adminRoomForm,pricePerNight:e.target.value})}/></label><label>Capacity<input required type="number" min="1" value={adminRoomForm.capacity} onChange={e=>setAdminRoomForm({...adminRoomForm,capacity:e.target.value})}/></label></div>
            <label>Image URL<input value={adminRoomForm.image} onChange={e=>setAdminRoomForm({...adminRoomForm,image:e.target.value})}/></label>
            <label>Amenities (comma-separated)<input value={adminRoomForm.amenities} onChange={e=>setAdminRoomForm({...adminRoomForm,amenities:e.target.value})}/></label>
            <button className="submit-btn">Add room <span>↗</span></button>
          </form></div>
          <div><h3>Manage rooms</h3><div className="admin-room-list">{rooms.map(r=><div key={r._id}><span><b>{r.name}</b><small>{r.type} · {money(r.pricePerNight)}/night</small></span><button className="mini-btn" onClick={()=>deleteRoom(r._id)}>Delete</button></div>)}</div></div>
        </div>
        <h3>All bookings</h3><div className="table-wrap"><table><thead><tr><th>Guest</th><th>Room</th><th>Dates</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>{adminBookings.map(b=><tr key={b._id}><td>{b.user?.name || b.guestName}<small className="table-sub">{b.user?.email || b.email}</small></td><td>{b.room?.name || "—"}</td><td>{new Date(b.checkIn).toLocaleDateString()} – {new Date(b.checkOut).toLocaleDateString()}</td><td>{money(b.totalPrice)}</td><td><span className={`status ${b.status}`}>{b.status.replace("_"," ")}</span></td><td>{b.paymentStatus}</td></tr>)}</tbody></table></div>
      </section>}

      <section className="quote-band"><span>✳</span><p>“The best journeys bring you back to yourself.”</p><small>MAKE YOURSELF AT HOME</small></section>

      <section className="help-section" id="help">
        <div className="eyebrow dark"><span></span> HERE TO HELP</div>
        <div className="help-heading"><h2>Good to <em>know.</em></h2><p>Quick answers for a smooth stay. For personal assistance, give us a call.</p></div>
        <div className="help-faqs">
          <details><summary>How do I book a room?</summary><p>Choose a room, select your check-in and check-out dates, enter your guest details, then sign in and complete payment. Your paid booking will appear under My bookings.</p></details>
          <details><summary>What if the room is already booked for my dates?</summary><p>That room cannot be booked for overlapping dates. Choose different dates or another room.</p></details>
          <details><summary>How do I cancel a booking?</summary><p>Open My bookings and choose Cancel booking for an unpaid booking. Paid bookings are not automatically refunded; contact the hotel for help with a refund.</p></details>
          <details><summary>Where can I find my receipt?</summary><p>Open My bookings after payment and select View receipt on the paid booking. You can print or save it from there.</p></details>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="contact-card">
          <div><div className="eyebrow"><span></span> WE'RE HERE FOR YOU</div><h2>Let’s make your stay <em>easy.</em></h2><p>Questions about a room or booking? Call us and we’ll be happy to help.</p></div>
          <div className="contact-links">
            <a className="contact-phone" href="tel:6303405174"><span aria-hidden="true">☎</span><span><small>CALL US</small><strong>6303405174</strong></span><span aria-hidden="true">↗</span></a>
            <a className="contact-phone" href="mailto:hotelroom.io.@room.com"><span aria-hidden="true">✉</span><span><small>EMAIL US</small><strong>hotelroom.io.@room.com</strong></span><span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark">H</span><span>Hotel Rooms</span></a><span>Thoughtful stays, unforgettable days.</span><span>© 2026 HOTEL ROOMS</span></footer>

    {selected && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) setSelected(null); }}>
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="modal-close" onClick={() => !submitting && setSelected(null)} aria-label="Close">×</button>
        <div className="eyebrow dark"><span></span> DEMO CHECKOUT · NO REAL CHARGE</div><h2 id="booking-title">{demoPaymentOpen ? <>Demo <em>payment.</em></> : <>Book your <em>room.</em></>}</h2>
        <div className="modal-room"><img src={selected.image} alt="" /><div><b>{selected.name}</b><small>{selected.type} · up to {selected.capacity} guests</small><strong>{money(selected.pricePerNight)} <small>/ night</small></strong></div></div>
        {demoPaymentOpen ? <>
          <p className="auth-hint">This is a simulated payment for demonstration only. No card details are needed and no money will be charged.</p>
          <div className="total-row"><span>{nights} night{nights === 1 ? "" : "s"} · {form.guests} guest{Number(form.guests) === 1 ? "" : "s"}</span><strong>{money(nights * selected.pricePerNight)}</strong></div>
          <div className="booking-form-actions">
            <button className="booking-back-btn" type="button" onClick={() => setDemoPaymentOpen(false)}>← Back</button>
            <button className="submit-btn" type="button" onClick={completeDemoPayment}>Complete demo payment</button>
          </div>
          {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}
        </> : <form onSubmit={book}>
          <p className="auth-hint">Try the demo checkout without signing in. This does not create a real reservation or charge.</p>
          <label>Full name<input required value={form.guestName} onChange={(e) => update("guestName", e.target.value)} placeholder="Your name" /></label>
          <label>Email address<input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" /></label>
          <div className="form-row"><label>Check-in<input required type="date" min={today} value={form.checkIn} onChange={(e) => update("checkIn", e.target.value)} /></label><label>Check-out<input required type="date" min={form.checkIn || today} value={form.checkOut} onChange={(e) => update("checkOut", e.target.value)} /></label></div>
          <label>Guests<select value={form.guests} onChange={(e) => update("guests", e.target.value)}>{Array.from({length: selected.capacity}, (_, i) => <option key={i} value={i + 1}>{i + 1} {i === 0 ? "guest" : "guests"}</option>)}</select></label>
          {nights > 0 && <div className="total-row"><span>{nights} night{nights > 1 ? "s" : ""} × {money(selected.pricePerNight)}</span><strong>{money(nights * selected.pricePerNight)}</strong></div>}
          <div className="booking-form-actions">
            <button className="booking-back-btn" type="button" disabled={submitting} onClick={() => { setSelected(null); setBookingError(""); }}>← Back</button>
            <button className="submit-btn" disabled={submitting}>Continue to demo payment <span>↗</span></button>
          </div>
          {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}
        </form>}
      </section>
    </div>}

    {authOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false); }}>
      <section className="booking-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close">×</button>
        <div className="eyebrow dark"><span></span> WELCOME TO HAVEN</div><h2 id="auth-title">{authMode === "login" ? <>Welcome <em>back.</em></> : <>Create your <em>account.</em></>}</h2>
        <form onSubmit={authenticate}>
          {authMode === "register" && <label>Full name<input required value={authForm.name} onChange={e=>setAuthForm({...authForm,name:e.target.value})} placeholder="Your name"/></label>}
          <label>Email address<input required type="email" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="you@example.com"/></label>
          <label>Password<input required type="password" minLength={8} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder="At least 8 characters"/></label>
          <button className="submit-btn" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"} <span>↗</span></button>
        </form>
        <p className="switch-auth">{authMode === "login" ? "New to Haven?" : "Already have an account?"} <button onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
      </section>
    </div>}
  </div>;
}
