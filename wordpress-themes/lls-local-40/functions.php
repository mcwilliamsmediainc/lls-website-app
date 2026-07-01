<?php
/**
 * LLS Local 40 master theme — functions.
 *
 * Reusable across every Local 40 client. All client-specific data is read from
 * config.php (see lls_config()); this file contains only logic. Nothing here
 * should be edited to reskin a client.
 */

if (!defined('ABSPATH')) exit;

/* ------------------------------------------------------------
   Config loader + accessors
   ------------------------------------------------------------ */

/** Load and cache the client config array from config.php. */
function lls_config() {
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require get_template_directory() . '/config.php';
        if (!is_array($cfg)) $cfg = array();
    }
    return $cfg;
}

/** Top-level config accessor with default. */
function lls($key, $default = '') {
    $c = lls_config();
    return isset($c[$key]) ? $c[$key] : $default;
}

/** Nested lookup: lls_get('address_parts', 'city', ''). */
function lls_get($key, $sub, $default = '') {
    $c = lls_config();
    return isset($c[$key][$sub]) ? $c[$key][$sub] : $default;
}

/** tel: link derived from the single 'phone' config value (US +1). */
function lls_tel() {
    $digits = preg_replace('/\D+/', '', lls('phone'));
    if ($digits === '') return '';
    if (strlen($digits) === 10) $digits = '1' . $digits;
    return '+' . $digits;
}

/** Single-line address (uses 'address' string, or builds from parts). */
function lls_address_line() {
    $a = lls('address');
    if (is_string($a) && $a !== '') return $a;
    $p = lls('address_parts', array());
    return trim(($p['street'] ?? '') . ', ' . ($p['city'] ?? '') . ', ' . ($p['state'] ?? '') . ' ' . ($p['zip'] ?? ''), ', ');
}

/* ------------------------------------------------------------
   Theme setup
   ------------------------------------------------------------ */
add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('automatic-feed-links');
    add_theme_support('html5', array('search-form', 'comment-form', 'gallery', 'caption', 'style', 'script'));
    add_theme_support('custom-logo', array('height' => 48, 'width' => 200, 'flex-width' => true, 'flex-height' => true));
    register_nav_menus(array(
        'primary' => 'Primary Menu',
        'footer'  => 'Footer Menu',
    ));
});

/* ------------------------------------------------------------
   Assets + config-driven CSS custom properties
   ------------------------------------------------------------ */
add_action('wp_enqueue_scripts', function () {
    $cfg = lls_config();
    $ver = wp_get_theme()->get('Version');

    // Google Fonts
    $google = lls_get('fonts', 'google', '');
    if ($google) wp_enqueue_style('lls-fonts', $google, array(), null);

    // Main stylesheet (which @imports assets/theme.css)
    wp_enqueue_style('lls-style', get_stylesheet_uri(), $google ? array('lls-fonts') : array(), $ver);

    // Color tokens driven by config.php. Start from the full palette, then let the
    // three primary brand colors (color_primary/accent/sky) override the key tokens
    // so a client can reskin with just those three values.
    $palette = lls('palette', array());
    $palette['navy']   = lls('color_primary', isset($palette['navy'])   ? $palette['navy']   : '#0B2545');
    $palette['orange'] = lls('color_accent',  isset($palette['orange']) ? $palette['orange'] : '#F7941D');
    $palette['sky']    = lls('color_sky',     isset($palette['sky'])    ? $palette['sky']    : '#3FA8EF');

    $vars = '';
    foreach ($palette as $name => $hex) {
        $vars .= '--' . $name . ':' . $hex . ';';
    }
    $vars .= '--font-d:' . lls_get('fonts', 'heading', '"Source Serif 4",Georgia,serif') . ';';
    $vars .= '--font-b:' . lls_get('fonts', 'body', 'system-ui,-apple-system,sans-serif') . ';';
    wp_add_inline_style('lls-style', ':root{' . $vars . '}');

    // Nav + form behavior
    wp_enqueue_script('lls-theme', get_template_directory_uri() . '/assets/theme.js', array(), $ver, true);
});

/* ------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------ */

/** Inline SVG icons. */
function lls_icon($name, $cls = 'ic') {
    $p = array(
        'phone'  => '<path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1z"/>',
        'check'  => '<path d="M20 6L9 17l-5-5"/>',
        'star'   => '<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/>',
        'pin'    => '<path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
        'clock'  => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        'mail'   => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        'scale'  => '<path d="M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z"/>',
        'shield' => '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
    );
    $body = isset($p[$name]) ? $p[$name] : '';
    return '<svg class="' . esc_attr($cls) . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $body . '</svg>';
}

/** Five-star rating row. */
function lls_stars($rating = 5) {
    return '<span class="stars" aria-label="' . esc_attr($rating) . ' star rating">' . str_repeat('&#9733;', 5) . '</span>';
}

/** Is the given (or current) page a configured service / location page. */
function lls_is_service($slug = null) {
    $slug = $slug ?: get_post_field('post_name', get_queried_object_id());
    return array_key_exists($slug, lls('services', array()));
}
function lls_is_location($slug = null) {
    $slug = $slug ?: get_post_field('post_name', get_queried_object_id());
    return array_key_exists($slug, lls('locations', array()));
}

/** Permalink for a page by slug (falls back to home). */
function lls_url($slug) {
    $p = get_page_by_path($slug);
    return $p ? get_permalink($p) : home_url('/');
}

/**
 * Resolve a hero / feature image: page featured image first, then the named
 * config image zone (attachment ID), then the passed default. This lets the
 * harvested-image mapping drive heroes while degrading gracefully.
 */
function lls_hero_img($default = '', $zone_key = '', $post_id = null) {
    $post_id = $post_id ?: get_the_ID();
    if (!$post_id) $post_id = get_queried_object_id();
    if ($post_id && has_post_thumbnail($post_id)) {
        $url = get_the_post_thumbnail_url($post_id, 'full');
        if ($url) return $url;
    }
    if ($zone_key) {
        $id = (int) lls($zone_key, 0);
        if ($id) {
            $url = wp_get_attachment_image_url($id, 'full');
            if ($url) return $url;
        }
    }
    return $default;
}

/** Resolve a config image zone to a URL, '' if unset. */
function lls_zone_img($zone_key, $size = 'large') {
    $id = (int) lls($zone_key, 0);
    if (!$id) return '';
    $url = wp_get_attachment_image_url($id, $size);
    return $url ?: '';
}

/** Related services (excludes current), returns slug=>label. */
function lls_related_services($exclude = '', $limit = 6) {
    $services = lls('services', array());
    unset($services[$exclude]);
    return array_slice($services, 0, $limit, true);
}

/* ------------------------------------------------------------
   Lead capture form (vertical-adaptive dropdown)
   ------------------------------------------------------------ */

/** Options + label for the "what do you need" dropdown, chosen by vertical. */
function lls_lead_options() {
    $vertical = lls('vertical', 'legal');
    if ($vertical === 'home_services') {
        return array('label' => 'What service do you need?', 'options' => lls('service_types', array()));
    }
    // legal / dental / other all default to the case-type list.
    return array('label' => 'What type of case?', 'options' => lls('case_types', array()));
}

/**
 * Render the lead capture form.
 *   variant 'hero'    -> .leadcard (name, phone, case type)
 *   variant 'contact' -> .cform    (name, phone, email, case type, message, consent)
 */
function lls_lead_form($args = array()) {
    $cfg = lls_config();
    $a = wp_parse_args($args, array(
        'variant' => 'hero',
        'title'   => 'Free Case Review',
        'sub'     => 'Tell us what happened. A real person responds &mdash; usually within the hour.',
        'button'  => 'Request My Free Review &rarr;',
        'id'      => 'lead-form',
    ));
    $drop     = lls_lead_options();
    $sent     = isset($_GET['sent']) && $_GET['sent'] === '1';
    $contact  = ($a['variant'] === 'contact');
    $wrap_cls = $contact ? 'cform' : 'leadcard';
    $biz      = lls('business_name');
    // Phone placeholder keeps the client's own area code.
    $pd   = preg_replace('/\D+/', '', lls('phone'));
    if (strlen($pd) === 11 && $pd[0] === '1') $pd = substr($pd, 1);
    $area = strlen($pd) >= 3 ? substr($pd, 0, 3) : '000';
    ob_start(); ?>
    <div class="<?php echo esc_attr($wrap_cls); ?>" id="<?php echo esc_attr($a['id']); ?>">
        <h3><?php echo esc_html($a['title']); ?></h3>
        <?php if (!$contact) : ?><div class="sm"><?php echo wp_kses_post($a['sub']); ?></div><?php endif; ?>
        <?php if ($sent) : ?>
            <div class="form-notice">Thank you. Your request has been received and a member of the <?php echo esc_html($biz); ?> team will follow up shortly.</div>
        <?php endif; ?>
        <form action="<?php echo esc_url(admin_url('admin-post.php')); ?>" method="post">
            <input type="hidden" name="action" value="lls_lead">
            <?php wp_nonce_field('lls_lead', 'lls_lead_nonce'); ?>
            <input type="hidden" name="source_page" value="<?php echo esc_attr(get_the_title()); ?>">
            <div class="field">
                <label for="<?php echo esc_attr($a['id']); ?>-name">Full name</label>
                <input id="<?php echo esc_attr($a['id']); ?>-name" type="text" name="lead_name" placeholder="Your name" required>
            </div>
            <div class="field">
                <label for="<?php echo esc_attr($a['id']); ?>-phone">Phone</label>
                <input id="<?php echo esc_attr($a['id']); ?>-phone" type="tel" name="lead_phone" placeholder="(<?php echo esc_attr($area); ?>) 000-0000" required>
            </div>
            <?php if ($contact) : ?>
            <div class="field">
                <label for="<?php echo esc_attr($a['id']); ?>-email">Email</label>
                <input id="<?php echo esc_attr($a['id']); ?>-email" type="email" name="lead_email" placeholder="you@email.com">
            </div>
            <?php endif; ?>
            <div class="field">
                <label for="<?php echo esc_attr($a['id']); ?>-case"><?php echo esc_html($drop['label']); ?></label>
                <select id="<?php echo esc_attr($a['id']); ?>-case" name="lead_case">
                    <?php foreach ($drop['options'] as $ct) : ?>
                        <option value="<?php echo esc_attr($ct); ?>"><?php echo esc_html($ct); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <?php if ($contact) : ?>
            <div class="field">
                <label for="<?php echo esc_attr($a['id']); ?>-msg">Briefly, what happened?</label>
                <textarea id="<?php echo esc_attr($a['id']); ?>-msg" name="lead_message" placeholder="A sentence or two is plenty."></textarea>
            </div>
            <div class="consent">
                <input type="checkbox" id="<?php echo esc_attr($a['id']); ?>-consent" name="lead_consent" required>
                <label for="<?php echo esc_attr($a['id']); ?>-consent">I agree to be contacted by <?php echo esc_html($biz); ?> by phone, text, or email about my inquiry. Consent is not a condition of any purchase. Msg/data rates may apply.</label>
            </div>
            <?php endif; ?>
            <button type="submit" class="btn btn-orange"><?php echo wp_kses_post($a['button']); ?></button>
            <?php if (!$contact) : ?><div class="disc"><?php echo esc_html(lls('form_disclaimer', 'By submitting you agree to be contacted about your inquiry.')); ?></div><?php endif; ?>
        </form>
    </div>
    <?php
    return ob_get_clean();
}

/* ------------------------------------------------------------
   Lead form handler (first-party, no third-party form plugin)
   ------------------------------------------------------------ */
function lls_handle_lead() {
    if (!isset($_POST['lls_lead_nonce']) || !wp_verify_nonce($_POST['lls_lead_nonce'], 'lls_lead')) {
        wp_safe_redirect(home_url('/'));
        exit;
    }
    $name  = sanitize_text_field($_POST['lead_name']  ?? '');
    $phone = sanitize_text_field($_POST['lead_phone'] ?? '');
    $email = sanitize_email($_POST['lead_email']      ?? '');
    $case  = sanitize_text_field($_POST['lead_case']  ?? '');
    $msg   = sanitize_textarea_field($_POST['lead_message'] ?? '');
    $src   = sanitize_text_field($_POST['source_page'] ?? '');
    $ref   = wp_get_referer() ?: home_url('/');

    $to = lls('email');
    $subject = 'New lead: ' . ($case ?: 'General');
    $body  = "Name: $name\n";
    $body .= "Phone: $phone\n";
    $body .= "Email: $email\n";
    $body .= "Type: $case\n";
    $body .= "Page: $src\n\n";
    $body .= "Message:\n$msg\n";
    if ($to) @wp_mail($to, $subject, $body);

    wp_safe_redirect(add_query_arg('sent', '1', $ref) . '#lead-form');
    exit;
}
add_action('admin_post_nopriv_lls_lead', 'lls_handle_lead');
add_action('admin_post_lls_lead', 'lls_handle_lead');

/* ------------------------------------------------------------
   Reusable design-system blocks (config-driven, overridable)
   ------------------------------------------------------------ */

/** Sticky sidebar CTA card (service / location / faq pages). */
function lls_sidecard() {
    $phone    = lls('phone');
    $tel      = lls_tel();
    $portrait = lls_zone_img('img_attorney', 'medium');
    $fee      = lls('fee_disclaimer', 'Free consultation');
    $first    = explode(' ', trim(lls('attorney_name', 'our')))[0];
    ob_start(); ?>
    <aside class="aside">
        <div class="sidecard">
            <?php if ($portrait) : ?>
            <div class="imgph has" style="min-height:150px;margin-bottom:16px;background-image:url('<?php echo esc_url($portrait); ?>')"></div>
            <?php endif; ?>
            <h4><?php echo esc_html(lls('sidecard_title', 'Talk to us free.')); ?></h4>
            <p>A real person from <?php echo esc_html($first); ?>'s team responds &mdash; usually within the hour.</p>
            <span class="ph"><?php echo esc_html($phone); ?></span>
            <a href="tel:<?php echo esc_attr($tel); ?>" class="btn btn-orange">Call Now</a>
            <a href="<?php echo esc_url(lls_url('contact')); ?>" class="btn btn-sky"><?php echo esc_html(lls('sidecard_button', 'Request Free Review')); ?></a>
            <div class="dots"><?php echo esc_html($fee); ?><br>Free consultation &middot; 24/7</div>
        </div>
    </aside>
    <?php
    return ob_get_clean();
}

/** Closing navy CTA band used across inner pages. */
function lls_ctaband() {
    $phone = lls('phone');
    $tel   = lls_tel();
    $biz   = lls('business_name');
    $brand = lls('slogan_brand', explode(' ', $biz)[0] . '.');
    $lead  = lls('slogan_lead', 'Ready when you are.');
    ob_start(); ?>
    <section class="ctaband">
        <div class="inner">
            <div class="tagline"><?php echo esc_html($lead); ?> Call <b><?php echo esc_html($brand); ?></b></div>
            <p><?php echo wp_kses_post(lls('cta_band_sub', 'Free consultation &middot; ' . lls('fee_disclaimer', 'No fee unless we win') . ' &middot; Calls answered 24/7')); ?></p>
            <div class="cta">
                <a href="tel:<?php echo esc_attr($tel); ?>" class="btn btn-orange">Call <?php echo esc_html($phone); ?></a>
                <a href="<?php echo esc_url(lls_url('contact')); ?>" class="btn btn-ghost"><?php echo esc_html(lls('ctaband_button', 'Request a Free Consultation')); ?> &rarr;</a>
            </div>
        </div>
    </section>
    <?php
    return ob_get_clean();
}

/* ------------------------------------------------------------
   Primary navigation fallback (config-driven mega menu)

   The 'primary' menu location is driven by the WordPress menu system via
   wp_nav_menu() in header.php. When no menu is assigned, this fallback renders
   the config-driven services / areas mega menu, so a fresh client site works
   without any menu setup and matches the design system out of the box.
   ------------------------------------------------------------ */
function lls_default_nav($args = array()) {
    $slug = is_singular() ? get_post_field('post_name', get_queried_object_id()) : '';
    $is_services = lls_is_service($slug);
    $is_about    = ($slug === 'about');
    $is_areas    = lls_is_location($slug);
    $is_faq      = ($slug === 'faq');
    $is_contact  = ($slug === 'contact');
    $na  = function ($cond) { return $cond ? ' active' : ''; };
    $svc = lls('services', array());
    $loc = lls('locations', array());
    $sig = lls('signature_service', array());
    $first_service = $svc ? array_key_first($svc) : 'contact';
    $first_loc     = $loc ? array_key_first($loc) : 'contact';
    ob_start(); ?>
            <a class="<?php echo trim($na($is_about)); ?>" href="<?php echo esc_url(lls_url('about')); ?>">About</a>

            <div class="has-sub<?php echo $na($is_services); ?>">
                <a class="navtrigger" href="<?php echo esc_url(lls_url($first_service)); ?>" aria-haspopup="true" aria-expanded="false">Services</a>
                <div class="dropdown cols">
                    <?php if (!empty($sig['slug'])) : ?>
                    <a class="feature" href="<?php echo esc_url(lls_url($sig['slug'])); ?>"><?php echo wp_kses_post($sig['label']); ?> <span><?php echo esc_html($sig['note'] ?? ''); ?></span></a>
                    <?php endif; ?>
                    <?php foreach ($svc as $sslug => $slabel) : if (!empty($sig['slug']) && $sslug === $sig['slug']) continue; ?>
                        <a href="<?php echo esc_url(lls_url($sslug)); ?>"><?php echo esc_html($slabel); ?></a>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="has-sub<?php echo $na($is_areas); ?>">
                <a class="navtrigger" href="<?php echo esc_url(lls_url($first_loc)); ?>" aria-haspopup="true" aria-expanded="false">Areas We Serve</a>
                <div class="dropdown cols">
                    <?php foreach ($loc as $lslug => $llabel) : ?>
                        <a href="<?php echo esc_url(lls_url($lslug)); ?>"><?php echo esc_html($llabel); ?></a>
                    <?php endforeach; ?>
                </div>
            </div>

            <a class="<?php echo trim($na($is_faq)); ?>" href="<?php echo esc_url(lls_url('faq')); ?>">FAQ</a>
            <a class="<?php echo trim($na($is_contact)); ?>" href="<?php echo esc_url(lls_url('contact')); ?>">Contact</a>
            <a class="btn btn-orange" href="<?php echo esc_url(lls_url('contact')); ?>"><?php echo esc_html(lls('cta_primary', 'Free Consultation')); ?></a>
    <?php
    echo ob_get_clean();
}
