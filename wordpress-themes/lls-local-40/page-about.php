<?php
/**
 * About page: firm story, attorney profile, why-choose pillars. Page slug "about".
 */
if (!defined('ABSPATH')) exit;
get_header();
$attorney = lls('attorney', array());
$since    = $attorney['since'] ?? '';
$first_name = explode(' ', trim($attorney['name'] ?? ''))[0];
$biz      = lls('business_name');
$phone    = lls('phone');
$tel      = lls_tel();
$portrait = lls_hero_img('', 'img_attorney');
while (have_posts()) : the_post(); ?>

<section class="pagehero">
    <div class="inner">
        <div class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Home</a><span>/</span>About</div>
        <h1>Tulsa's trusted injury advocates since <?php echo esc_html($since); ?>.</h1>
        <p>Personal injury is all we do &mdash; standing between injured Oklahomans and the insurance companies that would rather pay them as little as possible.</p>
    </div>
</section>

<section class="band">
    <div class="inner">
        <div class="khead">Who We Are</div>
        <h2 class="sec">We level the playing field.</h2>
        <div class="prose" style="margin-top:10px">
            <?php the_content(); ?>
        </div>
        <div class="facts four" style="margin-top:26px">
            <div class="fact"><b><?php echo esc_html($since); ?></b><small>Serving injured Oklahomans since</small></div>
            <div class="fact"><b><?php echo esc_html(lls('reviews_rating', '5')); ?>&#9733; &middot; <?php echo esc_html(lls('reviews_count')); ?></b><small>Google reviews from real clients</small></div>
            <div class="fact"><b>PI Only</b><small>Personal injury is all we do</small></div>
            <div class="fact"><b>24/7</b><small>Calls answered, day or night</small></div>
        </div>
    </div>
</section>

<section class="band mist meet">
    <div class="inner">
        <div class="portrait"<?php echo $portrait ? ' style="background-image:url(\'' . esc_url($portrait) . '\')"' : ''; ?>></div>
        <div>
            <div class="khead">Meet Your Attorney</div>
            <h2 class="sec"><?php echo esc_html($attorney['name'] ?? ''); ?></h2>
            <div class="role">Founding Trial Attorney &middot; Licensed in Oklahoma since <?php echo esc_html($since); ?></div>
            <div class="prose">
                <p><?php echo esc_html($attorney['bio'] ?? ''); ?></p>
                <p>His approach is straightforward: be honest with clients whether the news is good or bad, stay accessible when they need answers, and treat every case like the outcome matters &mdash; because for the people he represents, it always does.</p>
            </div>
            <div class="cta" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
                <a href="<?php echo esc_url(lls_url('contact')); ?>" class="btn btn-orange">Talk to <?php echo esc_html($first_name); ?> &mdash; Free &rarr;</a>
                <a href="tel:<?php echo esc_attr($tel); ?>" class="btn btn-ghost-d">Call <?php echo esc_html($phone); ?></a>
            </div>
        </div>
    </div>
</section>

<section class="band">
    <div class="inner">
        <div class="khead">Inside the Firm</div>
        <h2 class="sec">Tulsa's trusted injury and truck accident lawyers.</h2>
        <p class="lead-p">Real photos of the office and team build trust. <?php echo esc_html($biz); ?> represents injured people across the Tulsa metro.</p>
        <?php
        $firm_zones = array(
            array('zone' => 'img_office', 'label' => 'Office Exterior'),
            array('zone' => 'img_lobby',  'label' => 'Lobby'),
            array('zone' => 'img_team',   'label' => 'Team / Community'),
        );
        ?>
        <div class="imgband three">
            <?php foreach ($firm_zones as $fz) :
                $furl = lls_zone_img($fz['zone'], 'large');
            ?>
                <?php if ($furl) : ?>
                    <div class="imgph has" style="background-image:url('<?php echo esc_url($furl); ?>')" role="img" aria-label="<?php echo esc_attr($fz['label']); ?>"></div>
                <?php else : ?>
                    <div class="imgph"><?php echo esc_html($fz['label']); ?><span class="dim">540&times;340</span></div>
                <?php endif; ?>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<section class="band why">
    <div class="inner">
        <div class="khead" style="color:var(--sky-light)">Why <?php echo esc_html($biz); ?></div>
        <h2 class="sec">The steady, honest advocate you want in your corner.</h2>
        <p class="lead-p">Two values drive everything: complete transparency, and being there when you need us.</p>
        <div class="pillars">
            <div class="pillar"><div class="n">01</div><h4>Reliable &amp; Accessible</h4><p>Dependable and easy to reach when it matters most.</p></div>
            <div class="pillar"><div class="n">02</div><h4>Honest With You</h4><p>We tell you where you stand &mdash; good news or bad.</p></div>
            <div class="pillar"><div class="n">03</div><h4>Injury Law Only</h4><p>Personal injury is all we do, every day.</p></div>
            <div class="pillar"><div class="n">04</div><h4>We Work For You</h4><p>No fee unless we win. Your recovery is the priority.</p></div>
        </div>
    </div>
</section>

<?php echo lls_ctaband(); ?>

<?php endwhile; get_footer(); ?>
