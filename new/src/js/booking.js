const ACCESS_KEY = '22efb6c2-1884-4c68-b690-c1e24fca607a';

// Local calendar date as YYYY-MM-DD (toISOString would shift it to UTC)
function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const messages = {
    event_type: 'Pick the kind of event.',
    date: 'Choose the event date.',
    datePast: 'That date has passed. Pick today or a future date.',
    city: 'Which city is the event in?',
    name: 'Your name, please.',
    phone: 'A phone or WhatsApp number so Saurabh can reach you.',
    email: 'Enter a valid email address.',
};

export function initBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;
    const done = document.getElementById('bookDone');
    const status = document.getElementById('formStatus');
    const submitBtn = form.querySelector('button[type="submit"]');
    const date = form.elements.date;

    const setMin = () => { date.min = todayISO(); };
    setMin();
    date.addEventListener('focus', setMin);

    const showError = (name, msg) => {
        const p = form.querySelector(`[data-error-for="${name}"]`);
        if (p) p.textContent = msg || '';
        const field = form.elements[name];
        if (field && field.setAttribute) field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };

    const validate = () => {
        setMin();
        const errors = {};
        if (!form.querySelector('input[name="event_type"]:checked')) errors.event_type = messages.event_type;
        if (!date.value) errors.date = messages.date;
        else if (date.value < date.min) errors.date = messages.datePast;
        ['city', 'name', 'phone'].forEach(n => { if (!form.elements[n].value.trim()) errors[n] = messages[n]; });
        if (form.elements.phone.value.trim() && form.elements.phone.value.replace(/\D/g, '').length < 7) errors.phone = messages.phone;
        if (!form.elements.email.validity.valid || !form.elements.email.value) errors.email = messages.email;
        ['event_type', 'date', 'city', 'name', 'phone', 'email'].forEach(n => showError(n, errors[n]));
        return errors;
    };

    // Clear an error as soon as it's fixed
    form.addEventListener('input', e => {
        const n = e.target.name;
        if (!n) return;
        if (n === 'date') {
            setMin();
            showError('date', date.value && date.value < date.min ? messages.datePast : '');
        } else if (form.querySelector(`[data-error-for="${n}"]`)?.textContent) {
            showError(n, '');
        }
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        status.textContent = '';
        status.classList.remove('is-error');
        const errors = validate();
        const first = Object.keys(errors)[0];
        if (first) {
            const el = first === 'event_type' ? form.querySelector('input[name="event_type"]') : form.elements[first];
            el?.focus();
            return;
        }

        const data = new FormData(form);
        data.append('access_key', ACCESS_KEY);
        data.set('subject', `Booking enquiry: ${data.get('event_type')} on ${data.get('date')} in ${data.get('city')}`);

        const labelEl = submitBtn.querySelector('.btn-label > span') || submitBtn;
        const label = labelEl.textContent;
        labelEl.textContent = 'Sending…';
        submitBtn.disabled = true;
        try {
            const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: data });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.success === false) throw new Error(json.message || 'Request failed');
            form.reset();
            form.hidden = true;
            done.hidden = false;
            done.querySelector('h3').focus?.();
        } catch {
            status.textContent = 'That didn’t go through. Try again, or email saurabhkumardj@gmail.com directly.';
            status.classList.add('is-error');
        } finally {
            labelEl.textContent = label;
            submitBtn.disabled = false;
        }
    });

    document.getElementById('bookAgain')?.addEventListener('click', () => {
        done.hidden = true;
        form.hidden = false;
        setMin();
    });

    // "Book" links can preselect an occasion: data-occasion="Wedding / Sangeet"
    document.addEventListener('click', e => {
        const a = e.target.closest('[data-occasion]');
        if (!a) return;
        const r = form.querySelector(`input[name="event_type"][value="${a.dataset.occasion}"]`);
        if (r) r.checked = true;
    });
}
