const siteConfig = {
    githubUrl: "https://github.com/eddydq/PaddlingPulse"
};

document.querySelectorAll('[data-config-link="github"]').forEach((link) => {
    link.setAttribute("href", siteConfig.githubUrl);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noreferrer");
});

const revealItems = document.querySelectorAll("[data-reveal]");

revealItems.forEach((item) => item.classList.add("reveal-ready"));

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        {
            threshold: 0.18,
            rootMargin: "0px 0px -40px 0px"
        }
    );

    revealItems.forEach((item) => observer.observe(item));
} else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
}

const yearNode = document.getElementById("year");

if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
}
