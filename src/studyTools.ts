/** Teaser for study tools that are not built yet. Cards are informational, not links. */
const icons = {
  flashcards: '<rect x="3" y="7" width="14" height="12" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>',
  quizzes: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>',
  labels: '<path d="M4 4h8l8 8-8 8-8-8V4Z"/><circle cx="8.5" cy="8.5" r="1"/>',
} as const;

const studyTools = [
  { id: "flashcards", title: "Flashcards", copy: "Review names, attachments and actions for the structures you have explored." },
  { id: "quizzes", title: "Quizzes", copy: "Test yourself with identification and function questions, region by region." },
  { id: "labels", title: "Label practice", copy: "Name structures directly on the 3D model, then check your answers." },
] as const;

export function renderStudyTools() {
  return `<section class="intro-tools" aria-labelledby="intro-tools-heading">
    <div class="intro-section-heading"><p class="intro-eyebrow">Coming soon</p><h2 id="intro-tools-heading">Study what you explore.</h2><p class="intro-tools-lead">Practice tools are being built to sit alongside the models.</p></div>
    <ul class="intro-tools-grid">${studyTools.map(tool => `<li><div class="intro-feature-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[tool.id]}</svg></div><h3>${tool.title}</h3><p>${tool.copy}</p></li>`).join("")}</ul>
  </section>`;
}
