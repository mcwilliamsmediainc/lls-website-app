<?php
/**
 * Default page template (any page without a more specific template).
 */
if (!defined('ABSPATH')) exit;
get_header();
while (have_posts()) : the_post();
$heroimg = lls_hero_img('', 'img_hero'); ?>

<section class="pagehero<?php echo $heroimg ? ' photo' : ''; ?>"<?php echo $heroimg ? ' style="--heroimg:url(\'' . esc_url($heroimg) . '\')"' : ''; ?>>
    <div class="inner">
        <div class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Home</a><span>/</span><?php the_title(); ?></div>
        <h1><?php the_title(); ?></h1>
    </div>
</section>

<section class="band">
    <div class="inner">
        <div class="prose"><?php the_content(); ?></div>
    </div>
</section>

<?php echo lls_ctaband(); ?>

<?php endwhile; get_footer(); ?>
