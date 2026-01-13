export function initBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const thankYouMsg = document.getElementById('thankYouMessage');
    const formContent = form.querySelectorAll('.form-section, .form-actions'); // Select parts to hide

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        formData.append("access_key", "22efb6c2-1884-4c68-b690-c1e24fca607a");

        const originalText = submitBtn.textContent;

        submitBtn.textContent = "Sending...";
        submitBtn.disabled = true;

        try {
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                // Success - Hide form content and show thank you message
                formContent.forEach(el => el.style.display = 'none'); // Hide input sections
                submitBtn.style.display = 'none'; // Ensure button is hidden too if not covered

                if (thankYouMsg) {
                    thankYouMsg.style.display = 'block';
                    thankYouMsg.classList.remove('hidden');
                    // Scroll to message
                    thankYouMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    alert("Success! Your message has been sent.");
                    location.reload();
                }

                form.reset();
            } else {
                alert("Error: " + data.message);
            }

        } catch (error) {
            alert("Something went wrong. Please try again.");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Keep radio card effect if it doesn't interfere
    const radioCards = form.querySelectorAll('.radio-card input');
    radioCards.forEach(radio => {
        radio.addEventListener('change', () => {
            // Visual feedback handled by CSS
        });
    });
}
