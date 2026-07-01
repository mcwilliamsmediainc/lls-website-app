<?php
/**
 * Contact page: lead form, contact info cards, map. Page slug "contact".
 */
if (!defined('ABSPATH')) exit;
get_header();
$phone = lls('phone');
$tel   = lls_tel();
$email = lls('email');
$biz   = lls('business_name');
$first_name = explode(' ', trim(lls('attorney_name', 'our')))[0];
$map_q = rawurlencode(lls('map_query', lls_address_line()));
while (have_posts()) : the_post();
$heroimg = lls_hero_img('', 'img_hero'); ?>

<section class="pagehero<?php echo $heroimg ? ' photo' : ''; ?>"<?php echo $heroimg ? ' style="--heroimg:url(\'' . esc_url($heroimg) . '\')"' : ''; ?>>
    <div class="inner">
        <div class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Home</a><span>/</span>Contact</div>
        <h1><?php the_title(); ?></h1>
        <p>Free consultation. <?php echo esc_html(lls('fee_disclaimer', 'No fee unless we win')); ?>. Calls answered 24/7 &mdash; <?php echo esc_html($phone); ?>, <?php echo esc_html(lls('answered_line', 'Here to Help You')); ?>.</p>
    </div>
</section>

<section class="band">
    <div class="inner">
        <div class="split">
            <div>
                <div class="khead">Request a Free Consultation</div>
                <h2 class="sec">Tell us what happened.</h2>
                <p class="lead-p" style="margin-bottom:20px">A real person from <?php echo esc_html($first_name); ?>'s team responds &mdash; usually within the hour.</p>
                <?php echo lls_lead_form(array('variant' => 'contact', 'title' => 'Get Your Free Case Review', 'id' => 'contact-form')); ?>
            </div>
            <aside class="aside">
                <div class="infogrid" style="grid-template-columns:1fr">
                    <div class="infocard">
                        <div class="k">Call &mdash; <?php echo esc_html(lls('answered_line', 'Here to Help You')); ?></div>
                        <div class="v"><a href="tel:<?php echo esc_attr($tel); ?>"><?php echo esc_html($phone); ?></a></div>
                        <small>Calls answered 24/7</small>
                    </div>
                    <?php if ($email) : ?>
                    <div class="infocard">
                        <div class="k">Email</div>
                        <div class="v"><a href="mailto:<?php echo esc_attr($email); ?>"><?php echo esc_html($email); ?></a></div>
                    </div>
                    <?php endif; ?>
                    <div class="infocard">
                        <div class="k">Office</div>
                        <div class="v"><?php echo esc_html(lls_get('address_parts', 'street')); ?><br><?php echo esc_html(lls_get('address_parts', 'city') . ', ' . lls_get('address_parts', 'state') . ' ' . lls_get('address_parts', 'zip')); ?></div>
                    </div>
                    <div class="infocard">
                        <div class="k">Hours</div>
                        <div class="v"><?php echo esc_html(lls('hours_short')); ?></div>
                        <small>Phones answered 24/7 &middot; Free consultation &middot; <?php echo esc_html(lls('fee_disclaimer', 'No fee unless we win')); ?></small>
                    </div>
                </div>
            </aside>
        </div>
    </div>
</section>

<?php if (trim(get_the_content()) !== '') : ?>
<section class="band tight">
    <div class="inner">
        <div class="prose" style="margin:0 auto"><?php the_content(); ?></div>
    </div>
</section>
<?php endif; ?>

<section class="band tight mist">
    <div class="inner">
        <div class="mapph">
            <iframe title="Map to the <?php echo esc_attr($biz); ?> office" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=<?php echo esc_attr($map_q); ?>&z=15&output=embed"></iframe>
        </div>
    </div>
</section>

<?php echo lls_ctaband(); ?>

<?php endwhile; get_footer(); ?>
