import { useMemo, useState } from 'react';
import { useContent } from '../lib/content.jsx';
import { focusStyle } from '../lib/utils.js';
import { Reveal } from '../components/Bits.jsx';

const empty = { firstName: '', lastName: '', email: '', date: '', time: '', message: '', website: '' };

function Field({ label, error, children, id }) {
  return (
    <div className={'field' + (error ? ' has-error' : '')}>
      <label htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      {children}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export default function Contact() {
  const { contact, site } = useContent();
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | done | fail
  const [failMsg, setFailMsg] = useState('');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const slots = contact.timeSlots?.length ? contact.timeSlots : [];
  const set = (k) => (e) => {
    setV((o) => ({ ...o, [k]: e.target.value }));
    if (errors[k]) setErrors((o) => ({ ...o, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!v.firstName.trim()) e.firstName = 'Please enter your first name.';
    if (!v.lastName.trim()) e.lastName = 'Please enter your last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Please enter a valid email address.';
    if (!v.date) e.date = 'Please choose a date.';
    else if (v.date < today) e.date = 'Please choose a date from today onwards.';
    if (!v.time) e.time = 'Please choose a time.';
    if (v.message.trim().length < 2) e.message = 'Please write a short message.';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById('cf-' + Object.keys(e)[0])?.focus();
      return;
    }
    setState('sending');
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
      const data = await r.json().catch(() => ({}));
      if (r.status === 422 && data.errors) {
        setErrors(data.errors);
        setState('idle');
      } else if (!r.ok) {
        setFailMsg(data.error || 'Something went wrong. Please try again.');
        setState('fail');
      } else {
        setState('done');
        setV(empty);
      }
    } catch {
      setFailMsg('We could not reach the server. Please check your connection and try again.');
      setState('fail');
    }
  };

  return (
    <section className="contact">
      <Reveal as="h2" className="h2 center">{contact.title}</Reveal>
      <Reveal as="p" className="lead center" delay={100}>{contact.subtitle}</Reveal>
      <div className="contact-grid">
        {contact.image && (
          <Reveal className="contact-img" delay={120}>
            <img src={contact.image} alt={`${site.name}`} style={focusStyle(contact.focus)} loading="eager" decoding="async" />
          </Reveal>
        )}
        <Reveal className="contact-form-wrap" delay={200}>
          {state === 'done' ? (
            <div className="form-done" role="status">
              <p>{contact.successMessage}</p>
              <button className="btn" onClick={() => setState('idle')}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="field">
                <span className="label">Name <span aria-hidden="true">*</span></span>
                <div className="two">
                  <div className={errors.firstName ? 'has-error' : ''}>
                    <input id="cf-firstName" name="firstName" autoComplete="given-name" placeholder="First" value={v.firstName} onChange={set('firstName')} aria-label="First name" aria-invalid={!!errors.firstName} required />
                    {errors.firstName && <p className="field-error" role="alert">{errors.firstName}</p>}
                  </div>
                  <div className={errors.lastName ? 'has-error' : ''}>
                    <input id="cf-lastName" name="lastName" autoComplete="family-name" placeholder="Last" value={v.lastName} onChange={set('lastName')} aria-label="Last name" aria-invalid={!!errors.lastName} required />
                    {errors.lastName && <p className="field-error" role="alert">{errors.lastName}</p>}
                  </div>
                </div>
              </div>
              <Field label="Email" error={errors.email} id="cf-email">
                <input id="cf-email" type="email" name="email" autoComplete="email" value={v.email} onChange={set('email')} aria-invalid={!!errors.email} required />
              </Field>
              <div className="two meeting">
                <Field label="Schedule a meeting" error={errors.date} id="cf-date">
                  <input id="cf-date" type="date" name="date" min={today} value={v.date} onChange={set('date')} aria-invalid={!!errors.date} required />
                </Field>
                <Field label="Select Time" error={errors.time} id="cf-time">
                  <select id="cf-time" name="time" value={v.time} onChange={set('time')} aria-invalid={!!errors.time} required>
                    <option value="">Select time</option>
                    {slots.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Message" error={errors.message} id="cf-message">
                <textarea id="cf-message" name="message" rows={5} value={v.message} onChange={set('message')} aria-invalid={!!errors.message} required />
              </Field>
              <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.website} onChange={set('website')} />
              {state === 'fail' && <p className="form-fail" role="alert">{failMsg}</p>}
              <button className="btn btn-block" type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? 'SENDING…' : contact.buttonLabel || 'SEND MESSAGE'}
              </button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
