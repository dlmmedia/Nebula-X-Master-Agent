import os

# Configuration
OUTPUT_DIR = "nebula-x-assets"
COLORS = {
    "Deep Space": "#0B0D17",
    "Space Navy": "#111827",
    "Nebula Purple": "#7C3AED",
    "Cosmic Cyan": "#06B6D4",
    "Stellar Gold": "#F59E0B",
    "Starlight White": "#F1F5F9",
    "Aurora Green": "#10B981",
    "Mars Red": "#EF4444",
}

def create_svg(filename, width, height, content):
    svg = f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">\n{content}\n</svg>'
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w") as f:
        f.write(svg)
    print(f"Created {filename}")

def get_n_mark_path(scale=1.0, offset_x=0, offset_y=0):
    # A stylized N
    points = [
        (0, 100), (0, 0), (30, 0), (70, 70), (70, 0), (100, 0), (100, 100), (70, 100), (30, 30), (30, 100)
    ]
    path_d = "M " + " L ".join([f"{p[0]*scale + offset_x},{p[1]*scale + offset_y}" for p in points]) + " Z"
    return path_d

def get_wordmark_paths(scale=0.5, start_x=0, start_y=0):
    # Simple geometric paths for "NEBULA X"
    # Base height 100
    
    paths = []
    x = start_x
    
    # N
    paths.append(f'<path d="{get_n_mark_path(scale, x, start_y)}" fill="currentColor" />')
    x += 120 * scale
    
    # E
    pts_e = [(0,0), (80,0), (80,20), (20,20), (20,40), (60,40), (60,60), (20,60), (20,80), (80,80), (80,100), (0,100)]
    d_e = "M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_e]) + " Z"
    paths.append(f'<path d="{d_e}" fill="currentColor" />')
    x += 100 * scale
    
    # B
    pts_b_out = [(0,0), (60,0), (80,20), (80,40), (60,50), (80,60), (80,80), (60,100), (0,100)]
    pts_b_in1 = [(20,20), (50,20), (60,30), (50,40), (20,40)]
    pts_b_in2 = [(20,60), (50,60), (60,70), (50,80), (20,80)]
    
    d_b = "M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_b_out]) + " Z"
    d_b += " M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_b_in1]) + " Z"
    d_b += " M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_b_in2]) + " Z"
    paths.append(f'<path d="{d_b}" fill-rule="evenodd" fill="currentColor" />')
    x += 100 * scale
    
    # U
    pts_u = [(0,0), (20,0), (20,80), (60,80), (60,0), (80,0), (80,100), (0,100)] 
    d_u = "M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_u]) + " Z"
    paths.append(f'<path d="{d_u}" fill="currentColor" />')
    x += 100 * scale
    
    # L
    pts_l = [(0,0), (20,0), (20,80), (80,80), (80,100), (0,100)]
    d_l = "M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_l]) + " Z"
    paths.append(f'<path d="{d_l}" fill="currentColor" />')
    x += 100 * scale
    
    # A
    pts_a_out = [(40,0), (60,0), (100,100), (80,100), (70,70), (30,70), (20,100), (0,100)]
    pts_a_in = [(40,50), (60,50), (50,20)]
    d_a = "M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_a_out]) + " Z"
    d_a += " M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_a_in]) + " Z"
    paths.append(f'<path d="{d_a}" fill-rule="evenodd" fill="currentColor" />')
    x += 120 * scale

    # Space
    x += 40 * scale
    
    # X
    pts_x = [(0,0), (25,0), (50,40), (75,0), (100,0), (65,50), (100,100), (75,100), (50,60), (25,100), (0,100), (35,50)]
    d_x = "M " + " L ".join([f"{p[0]*scale + x},{p[1]*scale + start_y}" for p in pts_x]) + " Z"
    paths.append(f'<path d="{d_x}" fill="currentColor" />')
    x += 120 * scale
    
    return "".join(paths), x

def generate_assets():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # Common Gradients
    defs = f'''
    <defs>
        <linearGradient id="nebula_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:{COLORS['Nebula Purple']};stop-opacity:1" />
            <stop offset="100%" style="stop-color:{COLORS['Cosmic Cyan']};stop-opacity:1" />
        </linearGradient>
    </defs>
    '''

    # 1. nebula-x-mark.svg
    mark_path = get_n_mark_path(scale=0.8, offset_x=10, offset_y=10)
    mark_content = f'{defs}<path d="{mark_path}" fill="url(#nebula_gradient)" />'
    create_svg("nebula-x-mark.svg", 100, 100, mark_content)

    # 2. nebula-x-splash.svg
    splash_path = get_n_mark_path(scale=3.0, offset_x=50, offset_y=50)
    splash_content = f'{defs}<path d="{splash_path}" fill="url(#nebula_gradient)" />'
    create_svg("nebula-x-splash.svg", 400, 400, splash_content)

    # 3. nebula-x-wordmark.svg
    wordmark_paths, width = get_wordmark_paths(scale=0.5)
    wordmark_content = f'<g style="color:{COLORS["Starlight White"]}">{wordmark_paths}</g>'
    create_svg("nebula-x-wordmark.svg", int(width), 60, wordmark_content)
    
    # 4. nebula-x-logo-light.svg
    logo_paths, logo_width = get_wordmark_paths(scale=0.5, start_x=70, start_y=15)
    logo_mark = f'{defs}<path d="{get_n_mark_path(scale=0.6, offset_x=0, offset_y=10)}" fill="url(#nebula_gradient)" />'
    
    logo_light_content = f'''
    {logo_mark}
    <g style="color:{COLORS['Space Navy']}">{logo_paths}</g>
    '''
    create_svg("nebula-x-logo-light.svg", int(logo_width), 80, logo_light_content)

    # 5. nebula-x-logo-dark.svg
    logo_dark_content = f'''
    {defs}
    {logo_mark}
    <g style="color:{COLORS['Starlight White']}">{logo_paths}</g>
    '''
    create_svg("nebula-x-logo-dark.svg", int(logo_width), 80, logo_dark_content)

    # 6. Ornate logos
    ornate_blobs = f'''
    <circle cx="{int(logo_width)-10}" cy="10" r="5" fill="{COLORS['Stellar Gold']}" opacity="0.8" />
    <circle cx="10" cy="70" r="3" fill="{COLORS['Cosmic Cyan']}" opacity="0.6" />
    <path d="M 50,-10 L 52,-4 L 58,-2 L 52,0 L 50,6 L 48,0 L 42,-2 L 48,-4 Z" fill="{COLORS['Stellar Gold']}" />
    '''
    # Note: Inserting ornate_blobs effectively
    create_svg("nebula-x-logo-ornate-light.svg", int(logo_width), 80, f'<g>{logo_light_content}{ornate_blobs}</g>')
    create_svg("nebula-x-logo-ornate-dark.svg", int(logo_width), 80, f'<g>{logo_dark_content}{ornate_blobs}</g>')

    # 7. Pattern
    pattern_content = f'''
    <defs>
      <pattern id="stars" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="1.5" fill="{COLORS['Starlight White']}" fill-opacity="0.5"/>
        <circle cx="50" cy="60" r="2.5" fill="{COLORS['Starlight White']}" fill-opacity="0.3"/>
        <circle cx="80" cy="30" r="2" fill="{COLORS['Stellar Gold']}" fill-opacity="0.4"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="{COLORS['Deep Space']}" />
    <rect width="100%" height="100%" fill="url(#stars)" />
    '''
    create_svg("space-bg-pattern.svg", 400, 400, pattern_content)

    # 8. Favicon.svg
    create_svg("favicon.svg", 100, 100, mark_content)

if __name__ == "__main__":
    generate_assets()
