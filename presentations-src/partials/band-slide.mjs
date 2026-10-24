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

/** Throw on a variant the include doesn't know, so a typo can't ship silently. */
export function pick(variants, variant, include) {
  if (!(variant in variants)) {
    throw new Error(
      `@include ${include}: unknown variant "${variant}" (expected ${Object.keys(variants).join(' or ')})`
    );
  }
  return variants[variant];
}
