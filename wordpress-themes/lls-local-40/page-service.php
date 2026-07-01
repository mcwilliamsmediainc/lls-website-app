<?php
/**
 * Template Name: Service Page
 * Practice-area / service pages: photo page-hero, split content + sticky CTA card,
 * related services. Reusable via config; legal-vertical narrative by default.
 */
if (!defined('ABSPATH')) exit;
get_header();
$phone = lls('phone');
$tel   = lls_tel();
$slug  = get_post_field('post_name', get_the_ID());
$hero  = lls_hero_img('', 'img_hero');
$services = lls('services', array());
$first_service = $services ? array_key_first($services) : 'contact';
while (have_posts()) : the_post(); ?>

<section class="pagehero<?php echo $hero ? ' photo' : ''; ?>"<?php echo $hero ? ' style="--heroimg:url(\'' . esc_url($hero) . '\')"' : ''; ?>>
    <div class="inner">
        <div class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Home</a><span>/</span><a href="<?php echo esc_url(lls_url($first_service)); ?>">Practice Areas</a><span>/</span><?php the_title(); ?></div>
        <h1><?php the_title(); ?></h1>
        <p>Personal injury representation across Tulsa and northeastern Oklahoma &mdash; and we don't get paid unless you do.</p>
        <div class="cta">
            <a href="tel:<?php echo esc_attr($tel); ?>" class="btn btn-orange">Call <?php echo esc_html($phone); ?></a>
            <a href="<?php echo esc_url(lls_url('contact')); ?>" class="btn btn-ghost">Free Case Review &rarr;</a>
        </div>
    </div>
</section>

<section class="band">
    <div class="inner">
        <div class="split">
            <div>
                <div class="khead">Personal Injury Representation</div>
                <h2 class="sec"><?php the_title(); ?> in Tulsa &amp; Northeast Oklahoma</h2>
                <div class="prose">
                    <?php the_content(); ?>
                </div>

                <h3 class="sub">We also handle</h3>
                <div class="pgrid compact">
                    <?php foreach (lls_related_services($slug, 3) as $rslug => $rlabel) : ?>
                        <a class="pcard" href="<?php echo esc_url(lls_url($rslug)); ?>">
                            <h4><?php echo esc_html($rlabel); ?></h4>
                            <p>Representation for <?php echo esc_html(strtolower($rlabel)); ?> claims across the Tulsa metro.</p>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php echo lls_sidecard(); ?>
        </div>
    </div>
</section>

<?php echo lls_ctaband(); ?>

<?php endwhile; get_footer(); ?>
