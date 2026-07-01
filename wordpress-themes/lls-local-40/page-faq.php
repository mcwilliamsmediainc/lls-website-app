<?php
/**
 * Template Name: FAQ Page
 * Frequently asked questions in design-system accordions. Page slug "faq".
 * FAQ items come from config ('faqs'); the legal-vertical defaults are used when
 * the client config does not define its own.
 */
if (!defined('ABSPATH')) exit;
get_header();
$biz = lls('business_name');

$faqs = lls('faqs', array());
if (empty($faqs)) {
    $faqs = array(
        array('q' => 'What does it cost to hire ' . $biz . '?',
              'a' => 'Nothing up front. We work on contingency &mdash; no fee unless we win your case &mdash; and your consultation is always free.'),
        array('q' => 'How long do I have to file a claim in Oklahoma?',
              'a' => 'Generally two years, but important exceptions apply (claims involving government entities and wrongful death follow different rules). Evidence also fades fast, so acting early matters. We will confirm your exact deadline.'),
        array('q' => 'Should I give the insurance company a statement?',
              'a' => 'Not before talking to a lawyer. The insurer often uses early recorded statements to reduce what they pay. It is free to talk to us first.'),
        array('q' => 'What is my injury case worth?',
              'a' => 'Every case is different &mdash; value depends on your injuries, the insurance policies involved, and who is at fault. We cannot put a number on it here, but a free review will tell you what your claim could involve.'),
        array('q' => 'What types of cases do you handle?',
              'a' => 'We practice personal injury exclusively: semi-truck and 18-wheeler wrecks, car and motorcycle accidents, wrongful death, catastrophic and surgical injury, nursing home negligence, slip and fall, pedestrian injury, defective products, dog bites, and insurance disputes.'),
        array('q' => 'What areas do you serve?',
              'a' => 'We represent injured people across the Tulsa metro &mdash; including Broken Arrow, Owasso, Jenks, Bixby, Sand Springs, Sapulpa, Claremore, and the surrounding communities.'),
        array('q' => 'How soon will someone respond after I reach out?',
              'a' => 'A real person from John&rsquo;s team responds &mdash; usually within the hour. Calls are answered 24/7.'),
        array('q' => 'Do I have to go to court?',
              'a' => 'Many cases settle without a trial, but we prepare every case as if it will be tried. We are trial lawyers who are not afraid to litigate when that is what it takes to get you a fair result.'),
    );
}
while (have_posts()) : the_post();
$heroimg = lls_hero_img('', 'img_hero'); ?>

<section class="pagehero<?php echo $heroimg ? ' photo' : ''; ?>"<?php echo $heroimg ? ' style="--heroimg:url(\'' . esc_url($heroimg) . '\')"' : ''; ?>>
    <div class="inner">
        <div class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Home</a><span>/</span>FAQ</div>
        <h1><?php the_title(); ?></h1>
        <p>Straight answers about injury claims in Oklahoma &mdash; what they cost, how long they take, and how we protect your case.</p>
    </div>
</section>

<section class="band">
    <div class="inner">
        <div class="split">
            <div>
                <div class="khead">Common Questions</div>
                <h2 class="sec">Frequently asked questions.</h2>
                <?php if (trim(get_the_content()) !== '') : ?>
                    <div class="prose" style="margin-bottom:18px"><?php the_content(); ?></div>
                <?php endif; ?>
                <div style="margin-top:18px">
                    <?php foreach ($faqs as $i => $f) : ?>
                        <details class="faq"<?php echo $i === 0 ? ' open' : ''; ?>>
                            <summary><?php echo esc_html($f['q']); ?></summary>
                            <div class="a"><?php echo wp_kses_post($f['a']); ?></div>
                        </details>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php echo lls_sidecard(); ?>
        </div>
    </div>
</section>

<?php echo lls_ctaband(); ?>

<?php endwhile; get_footer(); ?>
