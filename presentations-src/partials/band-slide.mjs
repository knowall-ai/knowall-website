// Shared frame for a header-band content slide: the scene backdrop, the title
// band with its subtitle and logo, and a .content area holding `body`.
export function bandSlide({ label, scene, title, sub, contentClass = '', body }) {
  return `        <section class="scene" style="--scene: url('${scene}')" role="region" aria-label="${label}">
          <div class="band">
            <div>
              <h2>${title}</h2>
              <p class="band-sub">${sub}</p>
            </div>
            <img class="logo-dark" src="/images/logo.png" alt="KnowAll.ai" />
          </div>
          <div class="content${contentClass ? ` ${contentClass}` : ''}">
${body}          </div>
        </section>
`;
}
