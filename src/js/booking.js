export function initBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validation
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        let valid = true;

        inputs.forEach(input => {
            if (!input.value) {
                valid = false;
                input.style.borderColor = 'var(--color-primary)';
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => input.style.borderColor = '', 2000);
            }
        });

        if (!valid) return;

        // Web3Forms Integration
        const formData = new FormData(form);
        formData.append("access_key", "22efb6c2-1884-4c68-b690-c1e24fca607a");
        formData.append("subject", `New Booking Request from ${data.name || 'Website'}`);
        formData.append("from_name", data.name || "DJ Saurabh Website");

        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Sending...";
        submitBtn.disabled = true;

        try {
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                body: formData
            });

            const dataResponse = await response.json();

            if (response.ok) {
                // Success
                form.style.opacity = '0';
                setTimeout(() => {
                    form.style.display = 'none';
                    const successMsg = document.querySelector('.form-success');
                    successMsg.style.display = 'block';
                    successMsg.style.opacity = '0';
                    setTimeout(() => {
                        successMsg.style.opacity = '1';
                        successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                }, 300);
                form.reset();
            } else {
                alert("Error: " + dataResponse.message);
            }
        } catch (error) {
            console.error('Web3Forms Error:', error);
            alert("Something went wrong. Please try again.");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Radio card selection effect (handled by CSS, but keeping for any future enhancements)
    const radioCards = form.querySelectorAll('.radio-card input');
    radioCards.forEach(radio => {
        radio.addEventListener('change', () => {
            // Visual feedback handled by CSS
        });
    });
}
