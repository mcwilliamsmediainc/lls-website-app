<?php
/**
 * Front page (home). Structure + design system are reusable; identity, NAP,
 * phone, colors, attorney, services, locations and testimonials all read from
 * config.php. The section narrative below is the default for the legal vertical.
 */
if (!defined('ABSPATH')) exit;
get_header();
$attorney   = lls('attorney', array());
$since      = $attorney['since'] ?? '';
$first_name = explode(' ', trim($attorney['name'] ?? ''))[0];
$biz        = lls('business_name');
$brand      = lls('brand_short', '') ?: explode(' ', $biz)[0];
$phone      = lls('phone');
$tel        = lls_tel();
$hero_img   = lls_hero_img('', 'img_hero', get_option('page_on_front'));
$portrait   = lls_zone_img('img_attorney', 'large');

// Curated practice grid: card copy mapped to real service slugs.
$practice = array(
    array('slug' => 'motor-vehicle-accidents',           'title' => 'Car Wreck Injuries',       'desc' => 'Rear-end, intersection, distracted-driving and uninsured-motorist crashes across the Tulsa metro.'),
    array('slug' => 'motorcycle-accidents',              'title' => 'Motorcycle Collisions',    'desc' => 'Riders are vulnerable and often unfairly blamed. We push back and tell your side.'),
    array('slug' => 'wrongful-death',                    'title' => 'Wrongful Death',           'desc' => 'When negligence takes a loved one, we help families hold the responsible parties accountable.'),
    array('slug' => 'catastrophic-injury',               'title' => 'Catastrophic Injury',      'desc' => 'Life-changing injuries demand serious representation and a full accounting of future costs.'),
    array('slug' => 'surgical-injury',                   'title' => 'Surgical Injury',          'desc' => 'When a procedure goes wrong due to negligence, you have the right to answers.'),
    array('slug' => 'nursing-home-negligence-and-abuse', 'title' => 'Nursing Home Negligence',  'desc' => 'Abuse and neglect of the elderly is unacceptable. We give families a voice.'),
    array('slug' => 'slip-and-fall',                     'title' => 'Slip &amp; Fall',          'desc' => 'Unsafe property is the leading cause of nonfatal injury. Owners can be held liable.'),
    array('slug' => 'pedestrian-injury',                 'title' => 'Pedestrian Injury',        'desc' => 'Struck while walking? We fight for the full recovery you deserve.'),
    array('slug' => 'defective-products',                'title' => 'Defective Products',       'desc' => 'When a dangerous product causes harm, manufacturers must be held accountable.'),
    array('slug' => 'animal-dog-bite-injury',            'title' => 'Injuries From Animals',    'desc' => 'Dog bites and animal attacks can cause lasting harm. Know your rights.'),
    array('slug' => 'birth-injury',                      'title' => 'Birth Injury',             'desc' => 'Preventable harm during birth can affect a child for life. We are here to help.'),
    array('slug' => 'insurance-disputes',               'title' => 'Insurance Disputes',       'desc' => 'When your own insurer acts in bad faith, we hold them to their promises.'),
);
?>

<!-- HERO -->
<section class="hero" id="top"<?php echo $hero_img ? ' style="--heroimg:url(\'' . esc_url($hero_img) . '\')"' : ''; ?>>
    <div class="inner">
        <div>
            <span class="eyebrow">Semi-Truck &amp; 18-Wheeler Accident Lawyers</span>
            <h1>Hit by a truck in Oklahoma? <em>Don't face the trucking company alone.</em></h1>
            <p class="lede">Big rigs carry massive insurance policies and rapid-response crash teams. We level the field &mdash; and we don't get paid unless you do. Talk to a Tulsa trial lawyer today, free.</p>
            <div class="cta">
                <a href="tel:<?php echo esc_attr($tel); ?>" class="btn btn-orange">Call <?php echo esc_html($phone); ?></a>
                <a href="#contact" class="btn btn-ghost"><?php echo esc_html(lls('cta_secondary', 'Get a Free Case Review')); ?> &rarr;</a>
            </div>
            <div class="trust">
                <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span><i class="dot"></i> <?php echo esc_html(lls('fee_disclaimer', 'No fee unless we win')); ?></span>
                <span><i class="dot"></i> <?php echo esc_html(lls('years_experience', '20+')); ?> years of experience</span>
            </div>
        </div>
        <?php echo lls_lead_form(array('variant' => 'hero', 'title' => 'Free Case Review', 'id' => 'lead-form')); ?>
    </div>
</section>

<!-- TRUCK STRIP -->
<section class="band truck" id="truck">
    <div class="inner">
        <div>
            <div class="khead">Why Truck Cases Are Different</div>
            <h2 class="sec">A truck wreck isn't a car wreck.</h2>
            <p class="lead-p">Commercial trucks are governed by federal rules, carry far larger insurance policies, and involve more parties who can be held responsible. These cases are won or lost on evidence that disappears within days &mdash; which is why the firms who specialize win bigger.</p>
            <div class="cta-row">
                <a href="<?php echo esc_url(lls_url('semi-truck-accidents')); ?>" class="btn btn-navy">Start My Truck Wreck Review &rarr;</a>
                <a href="tel:<?php echo esc_attr($tel); ?>" class="btn btn-ghost-d">Call <?php echo esc_html($phone); ?></a>
            </div>
        </div>
        <div class="facts">
            <div class="fact"><b>$750K+</b><small>Minimum federal insurance commercial trucks must carry</small></div>
            <div class="fact"><b>5+</b><small>Parties who may be liable: driver, carrier, broker, loader, maker</small></div>
            <div class="fact"><b>Hours</b><small>How fast trucking firms deploy their own investigators</small></div>
            <div class="fact"><b>2 yrs</b><small>Oklahoma's filing deadline &mdash; but acting early protects evidence</small></div>
        </div>
    </div>
</section>

<!-- PRACTICE AREAS -->
<section class="band" id="practice">
    <div class="inner">
        <div class="khead">How We Help</div>
        <h2 class="sec">We fight for every kind of Oklahoma injury victim.</h2>
        <p class="lead-p" style="margin-bottom:30px">Trucks are our focus &mdash; but <?php echo esc_html($biz); ?> practices personal injury exclusively, and has done so since <?php echo esc_html($since); ?>. Whatever happened to you, we can help you understand your rights.</p>

        <div class="feat">
            <div>
                <div class="tag">Our Signature Practice</div>
                <h3>Semi-Truck &amp; 18-Wheeler Wrecks</h3>
                <p>From identifying every liable party to preserving the truck's black-box data before it's erased, we know how to take on the trucking companies and their insurers &mdash; and win.</p>
            </div>
            <a href="<?php echo esc_url(lls_url('semi-truck-accidents')); ?>" class="btn btn-orange">Free Truck Wreck Review &rarr;</a>
        </div>

        <div class="pgrid">
            <?php foreach ($practice as $p) :
                $service_page = get_page_by_path($p['slug']);
                $pimg = ($service_page && has_post_thumbnail($service_page->ID))
                    ? get_the_post_thumbnail_url($service_page->ID, 'medium')
                    : '';
            ?>
                <a class="pcard" href="<?php echo esc_url(lls_url($p['slug'])); ?>">
                    <?php if ($pimg) : ?>
                        <div class="imgph imgph-sm has" style="background-image:url('<?php echo esc_url($pimg); ?>')" role="img" aria-label="<?php echo esc_attr($p['title']); ?>"></div>
                    <?php else : ?>
                        <div class="imgph imgph-sm">Image<span class="dim">380&times;190</span></div>
                    <?php endif; ?>
                    <h4><?php echo wp_kses_post($p['title']); ?></h4>
                    <p><?php echo wp_kses_post($p['desc']); ?></p>
                    <span class="more">Learn more &rarr;</span>
                </a>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<!-- WHY CHOOSE -->
<section class="band why" id="why">
    <div class="inner">
        <div class="khead" style="color:var(--sky-light)">Why <?php echo esc_html($biz); ?></div>
        <h2 class="sec">The steady, honest advocate you want in your corner.</h2>
        <p class="lead-p">We practice personal injury exclusively. We're trial lawyers who aren't afraid to litigate &mdash; and we treat your case like it's our own.</p>
        <div class="pillars">
            <div class="pillar"><div class="n">01</div><h4>Reliable &amp; Accessible</h4><p>A team that's dependable and easy to reach when you need us most.</p></div>
            <div class="pillar"><div class="n">02</div><h4>Honest With You</h4><p>We tell you where you stand &mdash; whether the news is good or bad.</p></div>
            <div class="pillar"><div class="n">03</div><h4>Injury Law Only</h4><p>We practice personal injury exclusively. It's all we do, every day.</p></div>
            <div class="pillar"><div class="n">04</div><h4>We Work For You</h4><p>No fee unless we win. We dedicate ourselves to your full recovery.</p></div>
        </div>
    </div>
</section>

<!-- RESULTS / TESTIMONIALS -->
<?php $testimonials = lls('testimonials', array()); ?>
<?php if (!empty($testimonials)) : ?>
<section class="band" id="results">
    <div class="inner">
        <div class="khead">Real People, Real Results</div>
        <h2 class="sec">What our clients say.</h2>
        <div class="tgrid">
            <?php foreach ($testimonials as $t) : ?>
                <div class="tcard">
                    <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                    <p>&ldquo;<?php echo esc_html($t['text']); ?>&rdquo;</p>
                    <cite>&mdash; <?php echo esc_html($t['who']); ?></cite>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>
<?php endif; ?>

<!-- INSIDE THE FIRM -->
<section class="band mist">
    <div class="inner">
        <div class="khead">Inside the Firm</div>
        <h2 class="sec">Tulsa's trusted injury and truck accident lawyers.</h2>
        <p class="lead-p"><?php echo esc_html($biz); ?> represents injured Oklahomans across the Tulsa metro &mdash; in the office, in the community, and in the courtroom.</p>
        <?php
        // "Inside the Firm" zones, populated from harvested images via config image
        // zones; each falls back to its labelled placeholder if unset.
        $firm_zones = array(
            array('zone' => 'img_attorney', 'label' => 'Attorney'),
            array('zone' => 'img_office',   'label' => 'Office Exterior'),
            array('zone' => 'img_lobby',    'label' => 'Lobby'),
            array('zone' => 'img_team',     'label' => 'Team / Community'),
        );
        ?>
        <div class="imgband">
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

<!-- MEET THE ATTORNEY -->
<section class="band meet" id="attorney">
    <div class="inner">
        <div class="portrait"<?php echo $portrait ? ' style="background-image:url(\'' . esc_url($portrait) . '\')"' : ''; ?>></div>
        <div>
            <div class="khead">Meet Your Attorney</div>
            <h2 class="sec"><?php echo esc_html($attorney['name'] ?? ''); ?></h2>
            <div class="role">Founding Trial Attorney &middot; <?php echo esc_html($biz); ?></div>
            <p>Since <?php echo esc_html($since); ?>, <?php echo esc_html($attorney['name'] ?? ''); ?> has dedicated his practice entirely to personal injury law &mdash; standing up for injured Oklahomans against insurance companies and trucking corporations that would rather pay them as little as possible.</p>
            <p>His philosophy is simple: be honest, be accessible, and fight like the outcome matters &mdash; because for his clients, it always does. That's why <?php echo esc_html($biz); ?> is one of Tulsa's highest-rated injury firms.</p>
            <div class="cta" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">
                <a href="#contact" class="btn btn-orange">Talk to <?php echo esc_html($first_name); ?> &mdash; Free &rarr;</a>
                <a href="<?php echo esc_url(lls_url('about')); ?>" class="btn btn-ghost-d">More About the Firm</a>
            </div>
        </div>
    </div>
</section>

<!-- SERVICE AREAS -->
<section class="band areas">
    <div class="inner">
        <div class="khead">Serving the Tulsa Metro</div>
        <h2 class="sec">Local lawyers for local people.</h2>
        <div class="arealist">
            <?php foreach (lls('locations', array()) as $lslug => $llabel) : ?>
                <a href="<?php echo esc_url(lls_url($lslug)); ?>"><?php echo esc_html($llabel); ?></a>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<!-- CONTACT -->
<section class="band contact" id="contact">
    <div class="inner">
        <div>
            <div class="tagline"><?php echo esc_html(lls('slogan_lead')); ?><br>Call <b><?php echo esc_html(lls('slogan_brand', $brand . '.')); ?></b></div>
            <p class="lead-p" style="color:#cfdaea">Your consultation is free and there's no fee unless we win. The sooner you reach out, the more we can do to protect your case.</p>
            <div class="info">
                <b><?php echo esc_html($biz); ?></b><br>
                <?php echo esc_html(lls_address_line()); ?><br>
                <a href="tel:<?php echo esc_attr($tel); ?>" style="color:var(--sky-light);font-weight:700"><?php echo esc_html($phone); ?></a> &middot; <?php echo esc_html(lls('hours', 'Calls Answered 24/7')); ?>
            </div>
        </div>
        <?php echo lls_lead_form(array('variant' => 'contact', 'title' => 'Get Your Free Case Review', 'id' => 'contact-form')); ?>
    </div>
</section>

<?php get_footer(); ?>
