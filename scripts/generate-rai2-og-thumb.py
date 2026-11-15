import os
import math
from collections import deque
from PIL import Image, ImageDraw, ImageFont
import numpy as np

def clean_mascot_image(src_path):
    """Clean the background of the uploaded mascot image so it blends seamlessly."""
    img = Image.open(src_path).convert("RGBA")
    arr = np.array(img)
    h, w, _ = arr.shape

    bg_color = np.array([248.0, 250.0, 252.0])
    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    # Seed from all borders
    for x in range(w):
        queue.append((0, x))
        queue.append((h - 1, x))
    for y in range(h):
        queue.append((y, 0))
        queue.append((y, w - 1))

    alpha_mask = np.ones((h, w), dtype=float)

    while queue:
        y, x = queue.popleft()
        if visited[y, x]:
            continue
        visited[y, x] = True
        
        rgb = arr[y, x, :3].astype(float)
        dist = np.linalg.norm(rgb - bg_color)
        
        if dist < 7.0:
            alpha_mask[y, x] = 0.0
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                    queue.append((ny, nx))
        elif dist < 24.0:
            alpha_mask[y, x] = np.clip((dist - 7.0) / 17.0, 0.0, 1.0)

    arr[:, :, 3] = (alpha_mask * 255).astype(np.uint8)
    return Image.fromarray(arr)

def create_og_thumbnail():
    width = 1200
    height = 630
    
    # 1. Base Canvas - Clean bright ground matching rai2.si
    img = Image.new("RGBA", (width, height), (248, 249, 250, 255))
    
    # 2. Smooth Radial Blue Glow at top center (matching hero CSS exactly)
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    cx = width / 2.0
    cy = 60.0
    rx = width * 0.65
    ry = height * 0.75
    
    glow_pixels = glow.load()
    for y in range(height):
        for x in range(width):
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            dist = math.sqrt(nx * nx + ny * ny)
            if dist < 1.0:
                factor = (1.0 - dist) ** 1.5
                alpha = int(48 * factor)
                glow_pixels[x, y] = (0, 153, 255, alpha)
                
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)
    
    # Vertical stacking metrics:
    # 1. Logo: h ≈ 60px
    # 2. Gap: 14px
    # 3. Mascot team: w = 390px, h ≈ 103px
    # 4. Gap: 24px
    # 5. Title (3 lines * 50px): h = 136px
    # 6. Gap: 22px
    # 7. Badge: h = 42px
    # Total content height: 60 + 14 + 103 + 24 + 136 + 22 + 42 = 401px
    # Start Y: (630 - 401) / 2 ≈ 114px
    
    start_y = 78

    # 3. Logo RAI² in the exact horizontal center
    logo_path = "public/assets/rai-core-black.png"
    if os.path.exists(logo_path):
        logo_img = Image.open(logo_path).convert("RGBA")
        target_w = 135
        orig_w, orig_h = logo_img.size
        target_h = int(orig_h * (target_w / orig_w))
        logo_resized = logo_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        logo_x = int((width - target_w) / 2)
        logo_y = start_y
        img.paste(logo_resized, (logo_x, logo_y), logo_resized)
        current_y = logo_y + target_h + 14
    else:
        current_y = start_y + 60

    # 4. Mascot Team (5 Capybaras) seamlessly blended below Logo
    mascot_src = "C:/Users/Surface/.gemini/antigravity/brain/f31ab5dc-fc0a-4bfb-8dfe-3ae68850f549/.user_uploaded/media_1794752709245_514f3a5a.png"
    if os.path.exists(mascot_src):
        cleaned_mascot = clean_mascot_image(mascot_src)
        m_target_w = 400
        m_orig_w, m_orig_h = cleaned_mascot.size
        m_target_h = int(m_orig_h * (m_target_w / m_orig_w))
        mascot_resized = cleaned_mascot.resize((m_target_w, m_target_h), Image.Resampling.LANCZOS)
        m_x = int((width - m_target_w) / 2)
        m_y = current_y
        img.paste(mascot_resized, (m_x, m_y), mascot_resized)
        current_y = m_y + m_target_h + 24
    else:
        current_y += 120

    # 5. Main Headline: Without "RAI là" or "RAI² là", starting with "Bộ máy nhân sự số..."
    font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 36)
    lines = [
        "Bộ máy nhân sự số tự động thực thi các nghiệp vụ",
        "phòng ban, bám sát quy trình thực chiến và dưới sự",
        "kiểm soát của bạn để giải phóng người làm chủ."
    ]
    
    line_spacing = 50
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font_title)
        line_w = bbox[2] - bbox[0]
        x = (width - line_w) / 2
        y = current_y + (i * line_spacing)
        draw.text((x, y), line, fill=(17, 24, 39, 255), font=font_title)
        
    current_y += len(lines) * line_spacing + 24
    
    # 6. Badge under headline
    badge_text = "Được xây dựng dựa trên phương pháp luận RAI² First OS"
    font_badge = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 17)
    b_bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
    text_w = b_bbox[2] - b_bbox[0]
    bw = text_w + 44
    bh = 42
    bx = (width - bw) / 2
    by = current_y
    
    # Badge background (Soft cyan/blue pill matching rai2.si style)
    draw.rounded_rectangle(
        [bx, by, bx + bw, by + bh],
        radius=21,
        fill=(224, 242, 254, 255),
        outline=(186, 230, 253, 255),
        width=1
    )
    draw.text((bx + 22, by + 10), badge_text, fill=(2, 132, 199, 255), font=font_badge)

    # 7. Convert to RGB and save to all required paths
    final_img = img.convert("RGB")
    
    paths = [
        "saas/public/assets/rai2-share-og.png",
        "public/assets/rai2-share-og.png",
        "dist-saas/public/assets/rai2-share-og.png",
        "C:/Users/Surface/.gemini/antigravity/brain/f31ab5dc-fc0a-4bfb-8dfe-3ae68850f549/rai2-share-og.png"
    ]
    
    for p in paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        final_img.save(p, "PNG", optimize=True)
        print(f"Saved: {p} ({os.path.getsize(p)} bytes)")

if __name__ == "__main__":
    create_og_thumbnail()
