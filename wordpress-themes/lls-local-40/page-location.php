<?php
/**
 * Template Name: Location Page
 * Service-area pages: city page-hero, split local content + map + sticky CTA card.
 */
if (!defined('ABSPATH')) exit;
get_header();
$phone  = lls('phone');
$tel    = lls_tel();
$region = lls('region', 'Oklahoma');
$slug   = get_post_field('post_name', get_the_ID());
$locations = lls('locations', array());
$city   = isset($locations[$slug]) ? $locations[$slug] : get_the_title();
$first_loc = $locations ? array_key_first($locations) : 'contact';
$map_q  = rawurlencode($city . ', ' . $region);
$sig    = lls('signature_service', array());
while (have_posts()) : the_post();
$heroimg = lls_hero_img('', 'img_hero'); ?>

<section class="pagehero<?php echo $heroimg ? ' photo' : ''; ?>"<?php echo $heroimg ? ' style="--heroimg:url(\'' . esc_url($heroimg) . '\')"' : ''; ?>>
    <div class="inner">
        <div class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Home</a><span>/</span><a href="<?php echo esc_url(lls_url($first_loc)); ?>">Areas We Serve</a><span>/</span><?php echo esc_html($city); ?></div>
        <h1><?php the_title(); ?></h1>
        <p>Local injury representation for <?php echo esc_html($city); ?> families &mdash; from truck wrecks on the highway to falls at local businesses.</p>
        <div class="cta">
            <a href="tel:<?php echo esc_attr($tel); ?>" class="btn btn-orange">Call <?php echo esc_html($phone); ?></a>
            <a href="<?php echo esc_url(lls_url('contact')); ?>" class="btn btn-ghost"><?php echo esc_html(lls('cta_primary', 'Free Consultation')); ?> &rarr;</a>
        </div>
    </div>
</section>

<section class="band">
    <div class="inner">
        <div class="split">
            <div>
                <div class="khead">Serving <?php echo esc_html($city); ?></div>
                <h2 class="sec">A Tulsa-area injury firm that knows <?php echo esc_html($city); ?>.</h2>
                <div class="prose">
                    <?php the_content(); ?>
                </div>

                <h3 class="sub">How we help <?php echo esc_html($city); ?> clients</h3>
                <div class="pgrid compact">
                    <a class="pcard" href="<?php echo esc_url(lls_url('semi-truck-accidents')); ?>"><h4>Truck Wrecks</h4><p>Semi and 18-wheeler crashes on the highways and turnpikes.</p></a>
                    <a class="pcard" href="<?php echo esc_url(lls_url('motor-vehicle-accidents')); ?>"><h4>Car Wrecks</h4><p>Intersection and rear-end collisions across the city.</p></a>
                    <a class="pcard" href="<?php echo esc_url(lls_url('slip-and-fall')); ?>"><h4>Premises Liability</h4><p>Slip-and-falls and injuries at local businesses.</p></a>
                </div>

                <h3 class="sub">Serving <?php echo esc_html($city); ?> &amp; the Tulsa metro</h3>
                <div class="mapph" style="margin-top:8px">
                    <iframe title="Map of <?php echo esc_attr($city . ', ' . $region); ?>" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=<?php echo esc_attr($map_q); ?>&z=11&output=embed"></iframe>
                </div>

                <h3 class="sub">Other areas we serve</h3>
                <div class="arealist">
                    <?php foreach ($locations as $lslug => $llabel) : ?>
                        <a class="<?php echo $lslug === $slug ? 'here' : ''; ?>" href="<?php echo esc_url(lls_url($lslug)); ?>"><?php echo esc_html($llabel); ?></a>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php echo lls_sidecard(); ?>
        </div>
    </div>
</section>

<?php echo lls_ctaband(); ?>

<?php endwhile; get_footer(); ?>
