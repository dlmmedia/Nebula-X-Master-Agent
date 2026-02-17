import { ComponentProps, Show } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nebula-mark-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7C3AED" />
          <stop offset="100%" stop-color="#06B6D4" />
        </linearGradient>
        <linearGradient id="nebula-mark-g2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#F472B6" />
          <stop offset="50%" stop-color="#A78BFA" />
          <stop offset="100%" stop-color="#3B82F6" />
        </linearGradient>
      </defs>
      <ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)" stroke="url(#nebula-mark-g1)" stroke-width="1.8" fill="none" />
      <ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(35 12 12)" stroke="url(#nebula-mark-g2)" stroke-width="1.8" fill="none" />
      <circle cx="12" cy="12" r="1.2" fill="#67E8F9" />
      <circle cx="5.5" cy="6" r="0.7" fill="#F472B6" />
      <circle cx="18" cy="7" r="0.5" fill="#A78BFA" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class"> & { animated?: boolean }) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{
        [props.class ?? ""]: !!props.class,
        "logo-splash-animated": !!props.animated,
      }}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nebula-splash-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7C3AED" />
          <stop offset="50%" stop-color="#6366F1" />
          <stop offset="100%" stop-color="#06B6D4" />
        </linearGradient>
        <linearGradient id="nebula-splash-g2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#F472B6" />
          <stop offset="40%" stop-color="#A78BFA" />
          <stop offset="100%" stop-color="#3B82F6" />
        </linearGradient>
        <Show when={props.animated}>
          <radialGradient id="nebula-splash-glow">
            <stop offset="0%" stop-color="#67E8F9" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#67E8F9" stop-opacity="0" />
          </radialGradient>
        </Show>
      </defs>
      <Show when={props.animated}>
        <circle cx="40" cy="40" r="20" fill="url(#nebula-splash-glow)" class="splash-glow-bg" />
      </Show>
      <g class="splash-orbit-1" style={{ "transform-origin": "40px 40px" }}>
        <ellipse cx="40" cy="40" rx="36" ry="16" transform="rotate(-35 40 40)" stroke="url(#nebula-splash-g1)" stroke-width="4.5" fill="none" />
      </g>
      <g class="splash-orbit-2" style={{ "transform-origin": "40px 40px" }}>
        <ellipse cx="40" cy="40" rx="36" ry="16" transform="rotate(35 40 40)" stroke="url(#nebula-splash-g2)" stroke-width="4.5" fill="none" />
      </g>
      <g class="splash-core">
        <circle cx="40" cy="40" r="3" fill="#67E8F9" />
        <circle cx="40" cy="40" r="5" fill="none" stroke="#67E8F9" stroke-width="0.5" opacity="0.5" />
      </g>
      <circle cx="18" cy="22" r="2.5" fill="#F472B6" class="splash-star splash-star-1" />
      <circle cx="62" cy="24" r="1.8" fill="#A78BFA" class="splash-star splash-star-2" />
      <circle cx="56" cy="62" r="1.2" fill="#3B82F6" class="splash-star splash-star-3" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <defs>
        <linearGradient id="nebula-logo-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7C3AED" />
          <stop offset="100%" stop-color="#06B6D4" />
        </linearGradient>
        <linearGradient id="nebula-logo-g2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#F472B6" />
          <stop offset="50%" stop-color="#A78BFA" />
          <stop offset="100%" stop-color="#3B82F6" />
        </linearGradient>
      </defs>
      {/* Orbital X mark */}
      <g transform="translate(3, 3)">
        <ellipse cx="18" cy="18" rx="16" ry="7" transform="rotate(-35 18 18)" stroke="url(#nebula-logo-g1)" stroke-width="2.2" fill="none" />
        <ellipse cx="18" cy="18" rx="16" ry="7" transform="rotate(35 18 18)" stroke="url(#nebula-logo-g2)" stroke-width="2.2" fill="none" />
        <circle cx="18" cy="18" r="1.5" fill="#67E8F9" />
        <circle cx="8" cy="10" r="1" fill="#F472B6" />
        <circle cx="27" cy="11" r="0.7" fill="#A78BFA" />
      </g>
      {/* NEBULA X text - pixel-art style blocks matching the original aesthetic */}
      {/* N */}
      <path d="M48 30H42V18H48V30Z" fill="var(--icon-weak-base)" />
      <path d="M48 12H42V36H48V12ZM60 12H54V36H60V12ZM54 18H48V24H54V18Z" fill="var(--icon-base)" />
      {/* E */}
      <path d="M84 24V30H72V24H84Z" fill="var(--icon-weak-base)" />
      <path d="M84 24H72V30H84V36H66V6H84V24ZM72 18H78V12H72V18Z" fill="var(--icon-base)" />
      {/* B */}
      <path d="M108 24V30H96V18H108V24Z" fill="var(--icon-weak-base)" />
      <path d="M96 12V30H108V36H90V6H108V12H96ZM108 24V18H102V24H108Z" fill="var(--icon-base)" />
      {/* U */}
      <path d="M132 30H120V18H132V30Z" fill="var(--icon-weak-base)" />
      <path d="M120 6V30H132V6H138V36H114V6H120Z" fill="var(--icon-base)" />
      {/* L */}
      <path d="M156 30H150V18H156V30Z" fill="var(--icon-weak-base)" />
      <path d="M150 6V36H162V30H156V6H150Z" fill="var(--icon-base)" />
      {/* A */}
      <path d="M186 30H174V24H186V30Z" fill="var(--icon-weak-base)" />
      <path d="M174 12H186V6H168V36H174V24H186V36H192V6H186V12ZM174 18H186V12H174V18Z" fill="var(--icon-strong-base)" />
      {/* Space + X */}
      <path d="M210 18L218 6H226L216 21L226 36H218L210 24L202 36H194L204 21L194 6H202L210 18Z" fill="url(#nebula-logo-g1)" />
    </svg>
  )
}
