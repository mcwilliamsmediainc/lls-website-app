<?php
/**
 * Header: navy utility bar + white sticky header with logo mark and nav.
 * All values read from config.php. Primary nav is driven by the WordPress menu
 * system (wp_nav_menu), falling back to the config-driven mega menu.
 */
if (!defined('ABSPATH')) exit;
$tel   = lls_tel();
$phone = lls('phone');
$sky   = lls('color_sky', '#3FA8EF');
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link" href="#main">Skip to content</a>

<!-- UTILITY BAR -->
<div class="util">
    <div class="inner">
        <div class="left">
            <span class="phone"><a href="tel:<?php echo esc_attr($tel); ?>">Call <?php echo esc_html($phone); ?></a> &mdash; <?php echo esc_html(lls('answered_line', 'Here to Help You')); ?></span>
            <span><?php echo esc_html(lls_get('address_parts', 'street') . ', ' . lls_get('address_parts', 'city') . ', ' . lls_get('address_parts', 'state')); ?></span>
            <span><?php echo esc_html(lls('hours', 'Calls Answered 24/7')); ?></span>
        </div>
        <div class="rate">&#9733;&#9733;&#9733;&#9733;&#9733; <?php echo esc_html(lls('reviews_rating', '5')); ?> Stars &middot; <?php echo esc_html(lls('reviews_count')); ?> Google Reviews</div>
    </div>
</div>

<!-- HEADER -->
<header class="site-header">
    <div class="inner">
        <a class="logo" href="<?php echo esc_url(home_url('/')); ?>" aria-label="<?php echo esc_attr(lls('business_name')); ?> home">
            <?php if (has_custom_logo()) : the_custom_logo(); else : ?>
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="<?php echo esc_attr($sky); ?>" stroke-width="6"/><text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Source Serif 4,serif" font-weight="600" font-size="58" fill="<?php echo esc_attr($sky); ?>"><?php echo esc_html(lls('logo_letter', 'L')); ?></text></svg>
            <span class="nm"><?php echo esc_html(lls('logo_text', lls('business_name'))); ?></span>
            <?php endif; ?>
        </a>
        <button class="hamb" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="navmain"><span></span><span></span><span></span></button>
        <nav class="main" id="navmain" aria-label="Primary">
            <?php
            wp_nav_menu(array(
                'theme_location' => 'primary',
                'container'      => false,
                'items_wrap'     => '%3$s',
                'fallback_cb'    => 'lls_default_nav',
                'echo'           => true,
            ));
            ?>
        </nav>
    </div>
</header>

<main id="main">
