<?php
/**
 * Footer: dark multi-column footer, legal disclaimer, mobile call bar.
 * All values read from config.php.
 */
if (!defined('ABSPATH')) exit;
$tel     = lls_tel();
$phone   = lls('phone');
$biz     = lls('business_name');
$loc     = lls('locations', array());
$first_loc = $loc ? array_key_first($loc) : 'contact';
$footer_practice = lls('footer_practice', array());
?>
</main>

<footer class="site-footer">
    <div class="inner">
        <div class="fcols">
            <div>
                <div class="nm"><?php echo esc_html($biz); ?></div>
                <p style="color:#9db4cf;max-width:34ch"><?php echo esc_html(lls('footer_blurb')); ?></p>
                <p style="margin-top:14px;color:#fff;font-weight:700"><a href="tel:<?php echo esc_attr($tel); ?>"><?php echo esc_html($phone); ?></a> &mdash; <?php echo esc_html(lls('answered_line', 'Here to Help You')); ?></p>
            </div>
            <?php if (!empty($footer_practice)) : ?>
            <div>
                <h5><?php echo esc_html(lls('vertical') === 'home_services' ? 'Services' : 'Practice Areas'); ?></h5>
                <ul>
                    <?php foreach ($footer_practice as $fslug => $flabel) : ?>
                        <li><a href="<?php echo esc_url(lls_url($fslug)); ?>"><?php echo esc_html($flabel); ?></a></li>
                    <?php endforeach; ?>
                </ul>
            </div>
            <?php endif; ?>
            <div>
                <h5>Firm</h5>
                <ul>
                    <li><a href="<?php echo esc_url(lls_url('about')); ?>">About <?php echo esc_html(lls('attorney_name', $biz)); ?></a></li>
                    <li><a href="<?php echo esc_url(lls_url($first_loc)); ?>">Areas We Serve</a></li>
                    <li><a href="<?php echo esc_url(lls_url('contact')); ?>">Contact</a></li>
                </ul>
            </div>
        </div>
        <div class="disc-foot">
            <?php echo esc_html(lls('footer_legal')); ?> &middot;
            <?php echo esc_html($biz . ', ' . lls_address_line()); ?> &middot;
            <a href="tel:<?php echo esc_attr($tel); ?>"><?php echo esc_html($phone); ?></a> &middot; <?php echo esc_html(lls('footer_credit', 'Site by McWilliams Media')); ?>
        </div>
    </div>
</footer>

<a href="tel:<?php echo esc_attr($tel); ?>" class="scrollbar">Call <?php echo esc_html($phone); ?> &middot; Free</a>

<?php wp_footer(); ?>
</body>
</html>
