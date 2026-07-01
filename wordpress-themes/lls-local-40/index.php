<?php
/**
 * Fallback template (archives, search, blog). Required by WordPress.
 */
if (!defined('ABSPATH')) exit;
get_header();
?>
<section class="pagehero">
    <div class="inner">
        <h1><?php
            if (is_search()) { printf('Search results for %s', esc_html(get_search_query())); }
            elseif (is_archive()) { the_archive_title(); }
            else { single_post_title(); }
        ?></h1>
    </div>
</section>

<section class="band">
    <div class="inner">
        <div class="prose">
            <?php if (have_posts()) : while (have_posts()) : the_post(); ?>
                <article style="padding-bottom:28px;margin-bottom:28px;border-bottom:1px solid var(--line);">
                    <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
                    <?php the_excerpt(); ?>
                    <a class="more" href="<?php the_permalink(); ?>">Read more &rarr;</a>
                </article>
            <?php endwhile; the_posts_pagination(); else : ?>
                <p>No content was found. Please use the navigation above or contact us directly.</p>
                <p><a class="btn btn-orange" href="<?php echo esc_url(lls_url('contact')); ?>"><?php echo esc_html(lls('cta_secondary', 'Contact Us')); ?></a></p>
            <?php endif; ?>
        </div>
    </div>
</section>

<?php get_footer(); ?>
