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

/* Apple-style Inside RAI² Slider */
const initAppleSlider = () => {
  const track = document.querySelector(".apple-slides-track");
  const slides = document.querySelectorAll(".apple-slide");
  const dotsContainer = document.querySelector(".slider-dots");
  const prevBtn = document.querySelector(".slider-btn.prev-btn");
  const nextBtn = document.querySelector(".slider-btn.next-btn");
  const currentCounter = document.getElementById("slide-current");
  const viewport = document.querySelector(".apple-slider-viewport");

  if (!track || slides.length === 0) return;

  let currentIndex = 0;
  const total = slides.length;
  let autoplayTimer = null;

  if (dotsContainer) {
    dotsContainer.innerHTML = "";
    slides.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.className = `slider-dot ${i === 0 ? "active" : ""}`;
      dot.type = "button";
      dot.setAttribute("aria-label", `Xem slide ${i + 1}`);
      dot.addEventListener("click", () => goToSlide(i));
      dotsContainer.appendChild(dot);
    });
  }

  const updateUI = () => {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    if (currentCounter) {
      currentCounter.textContent = String(currentIndex + 1).padStart(2, "0");
    }
    const dots = dotsContainer?.querySelectorAll(".slider-dot");
    dots?.forEach((d, i) => {
      d.classList.toggle("active", i === currentIndex);
      d.setAttribute("aria-selected", i === currentIndex ? "true" : "false");
    });
  };

  const goToSlide = (idx) => {
    currentIndex = (idx + total) % total;
    updateUI();
  };

  prevBtn?.addEventListener("click", () => {
    goToSlide(currentIndex - 1);
    resetAutoplay();
  });

  nextBtn?.addEventListener("click", () => {
    goToSlide(currentIndex + 1);
    resetAutoplay();
  });

  // Touch Swipe for mobile
  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  viewport?.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = true;
    stopAutoplay();
  }, { passive: true });

  viewport?.addEventListener("touchend", (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    const diffX = e.changedTouches[0].clientX - startX;
    const diffY = e.changedTouches[0].clientY - startY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
      if (diffX < 0) goToSlide(currentIndex + 1);
      else goToSlide(currentIndex - 1);
    }
    startAutoplay();
  }, { passive: true });

  // Autoplay
  const startAutoplay = () => {
    stopAutoplay();
    autoplayTimer = setInterval(() => {
      goToSlide(currentIndex + 1);
    }, 6000);
  };

  const stopAutoplay = () => {
    if (autoplayTimer) clearInterval(autoplayTimer);
  };

  const resetAutoplay = () => {
    stopAutoplay();
    startAutoplay();
  };

  const container = document.querySelector(".apple-slider-container");
  container?.addEventListener("mouseenter", stopAutoplay);
  container?.addEventListener("mouseleave", startAutoplay);

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      goToSlide(currentIndex - 1);
      resetAutoplay();
    } else if (e.key === "ArrowRight") {
      goToSlide(currentIndex + 1);
      resetAutoplay();
    }
  });

  startAutoplay();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppleSlider);
} else {
  initAppleSlider();
}

/* 7-Zone Hiring Desk Tab Switching & Mobile Dropdown */
const zoneMeta = {
  "1": { tag: "Z1", title: "VÙNG 1: Văn Phòng Điều Hành & Chiến Lược" },
  "2": { tag: "Z2", title: "VÙNG 2: Phòng Marketing & Thu Hút" },
  "3": { tag: "Z3", title: "VÙNG 3: Phòng Kinh Doanh & Chốt Hợp Đồng" },
  "4": { tag: "Z4", title: "VÙNG 4: Phòng Thực Thi & Vận Hành" },
  "5": { tag: "Z5", title: "VÙNG 5: Phòng Chăm Sóc & Giữ Chân" },
  "6": { tag: "Z6", title: "VÙNG 6: Phòng Tài Chính & Dòng Tiền" },
  "7": { tag: "Z7", title: "VÙNG 7: Phòng Nhân Sự & Đào Tạo" }
};

const initHiringDesk = () => {
  const tabButtons = document.querySelectorAll(".zone-tab-btn");
  const panels = document.querySelectorAll(".zone-panel");
  const dropdownWrap = document.querySelector(".hiring-mobile-dropdown-wrap");
  const dropdownTrigger = document.getElementById("zone-dropdown-trigger");
  const triggerTag = document.getElementById("trigger-tag");
  const triggerTitle = document.getElementById("trigger-title");

  if (!tabButtons.length || !panels.length) return;

  // Toggle dropdown on mobile
  if (dropdownTrigger && dropdownWrap) {
    dropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdownWrap.classList.toggle("open");
      dropdownTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!dropdownWrap.contains(e.target)) {
        dropdownWrap.classList.remove("open");
        dropdownTrigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const zoneId = btn.getAttribute("data-zone");
      if (!zoneId) return;

      // Update active state on all buttons (both desktop sidebar and mobile dropdown items)
      tabButtons.forEach((b) => {
        if (b.getAttribute("data-zone") === zoneId) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });

      // Update panels
      panels.forEach((p) => {
        if (p.getAttribute("data-zone") === zoneId) {
          p.classList.add("active");
        } else {
          p.classList.remove("active");
        }
      });

      // Update mobile trigger label
      if (zoneMeta[zoneId] && triggerTag && triggerTitle) {
        triggerTag.textContent = zoneMeta[zoneId].tag;
        triggerTitle.textContent = zoneMeta[zoneId].title;
      }

      // Close mobile dropdown smoothly
      if (dropdownWrap) {
        dropdownWrap.classList.remove("open");
        dropdownTrigger?.setAttribute("aria-expanded", "false");
      }
    });
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHiringDesk);
} else {
  initHiringDesk();
}
