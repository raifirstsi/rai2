const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");
const sharedTheme = /(?:^|;\s*)rai2_theme=(light|dark)(?:;|$)/.exec(document.cookie)?.[1];
const saved = localStorage.getItem("rai2_landing_theme");
const initialTheme = sharedTheme || saved || "light";
root.dataset.theme = initialTheme;

const syncTheme = () => {
  const light = root.dataset.theme === "light";
  if (toggle) {
    const label = light ? "Bật giao diện tối" : "Bật giao diện sáng";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = light ? "#f8f9fa" : "#000000";
  }
  if (location.hostname === "rai2.si" || location.hostname.endsWith(".rai2.si")) {
    document.cookie = `rai2_theme=${root.dataset.theme}; Domain=rai2.si; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
  }
};

if (toggle) {
  toggle.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem("rai2_landing_theme", root.dataset.theme);
    syncTheme();
  });
}
syncTheme();

const syncLandingSession = (signedIn) => {
  const workspaceHref = signedIn ? "https://app.rai2.si/?open=1" : "https://app.rai2.si/";
  document.querySelectorAll(".session-cta").forEach((link) => {
    link.href = workspaceHref;
    link.textContent = signedIn ? "Truy cập RAI²" : "Trải nghiệm miễn phí";
  });
  document.querySelectorAll(".desktop-login-link, .mobile-login-link").forEach((link) => {
    link.textContent = signedIn ? "Quản lí tài khoản" : "Đăng nhập";
  });
};
syncLandingSession(/(?:^|;\s*)rai2_signed_in=1(?:;|$)/.test(document.cookie));

const mascot = document.querySelector(".headline-mascot");
const mascotMotion = mascot?.querySelector(".headline-mascot-motion");
const mascotBadge = mascot?.querySelector(".headline-badge");
const revealMascot = () => {
  mascot?.classList.add("is-ready");
  mascotMotion?.classList.add("is-ready");
};
if (mascotBadge?.complete && mascotBadge.naturalWidth > 0) revealMascot();
else mascotBadge?.addEventListener("load", revealMascot, { once: true });

if (location.hostname === "rai2.si") {
  void fetch("https://app.rai2.si/api/landing-session", { credentials: "include", cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("session unavailable")))
    .then((session) => syncLandingSession(session.signedIn === true))
    .catch(() => {});
}

const menuButton = document.querySelector(".mobile-menu-toggle");
const menu = document.querySelector(".mobile-dialog");
const closeMenu = () => {
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "Mở menu");
  if (menuButton) menuButton.title = "Mở menu";
};

menuButton?.addEventListener("click", () => {
  if (!menu) return;
  if (!menu.hidden) return closeMenu();
  menu.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  menuButton.setAttribute("aria-label", "Đóng menu");
  menuButton.title = "Đóng menu";
});
menu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("pointerdown", (event) => {
  if (!menu?.hidden && !menu?.contains(event.target) && !menuButton?.contains(event.target)) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !menu?.hidden) {
    closeMenu();
    menuButton?.focus();
  }
});
addEventListener("resize", () => {
  if (innerWidth > 960) closeMenu();
});
