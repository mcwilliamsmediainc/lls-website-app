<?php
/**
 * LLS Local 40 master theme — client configuration.
 *
 * THIS IS THE ONLY FILE THAT CHANGES PER CLIENT. Everything the theme renders
 * (identity, NAP, colors, vertical, services, locations, attorney, images) is
 * read from the array returned below. Drop the lls-local-40 theme onto any
 * Local 40 client site, edit this file, and the theme reskins itself.
 *
 * The top "Business identity" / "Vertical" / "Colors" blocks are the primary
 * edit surface. The structured blocks below them (palette shades, fonts,
 * services, locations, testimonials) are still client-specific but change less
 * often. Values flagged [VERIFY] in client-facts.md must be confirmed before
 * go-live.
 *
 * Returns a plain array; functions.php loads it via lls_config().
 */

if (!defined('ABSPATH')) exit;

return array(

    /* ========================================================
     * Business identity
     * ====================================================== */
    'business_name'    => 'Truskett Law',
    'tagline'          => 'Tulsa Personal Injury Attorneys',
    'logo_text'        => 'Truskett Law',   // wordmark shown next to the logo mark
    'logo_letter'      => 'T',              // single glyph inside the round logo mark
    'phone'            => '(918) 392-5444', // the ONLY place a phone number is set; tel: link is derived
    'email'            => 'john@truskettlaw.com',
    'address'          => '2921 East 91st Street, Suite 100, Tulsa, OK 74137',
    'address_parts'    => array(
        'street' => '2921 East 91st Street, Suite 100',
        'city'   => 'Tulsa',
        'state'  => 'OK',
        'zip'    => '74137',
    ),
    'map_query'        => '2921 East 91st Street, Suite 100, Tulsa, OK 74137',
    'hours'            => 'Calls Answered 24/7',            // always-available line (utility bar / hero)
    'hours_short'      => 'Monday to Friday, 8 AM to 5 PM', // shown on the contact page
    'answered_line'    => 'Here to Help You',               // "Call (phone) — Here to Help You"
    'reviews_count'    => '300+',
    'reviews_rating'   => '5',
    'years_experience' => '20+',

    /* ========================================================
     * Vertical + calls to action
     * ====================================================== */
    'vertical'         => 'legal', // legal | home_services | dental | other
    'cta_primary'      => 'Free Consultation',
    'cta_secondary'    => 'Get a Free Case Review',
    'form_disclaimer'  => 'By submitting you agree to be contacted about your inquiry. Not legal advice; no attorney-client relationship is formed.',
    'sidecard_title'   => 'Injured? Talk to us free.',
    'sidecard_button'  => 'Request Free Review',
    'ctaband_button'   => 'Request a Free Consultation',
    'hero_eyebrow'     => 'Tulsa Personal Injury Attorneys',
    'fee_disclaimer'   => 'No fee unless we win',

    /* Closing slogan shown on the home contact band + inner-page CTA band.
     * Rendered as: "<slogan_lead> Call <b><slogan_brand></b>". */
    'slogan_lead'      => "Don't Risk It,",
    'slogan_brand'     => 'Truskett.',
    'cta_band_sub'     => 'Free consultation &middot; No fee unless we win &middot; Calls answered 24/7',

    /* ========================================================
     * Colors — the three brand colors below drive the CSS custom
     * properties. The extended palette holds the derived shades the
     * design system uses; override any of them for a client if needed.
     * ====================================================== */
    'color_primary'    => '#0B2545', // navy  (maps to --navy)
    'color_accent'     => '#F7941D', // orange (maps to --orange)
    'color_sky'        => '#3FA8EF', // sky   (maps to --sky)

    'palette'          => array(
        'sky'       => '#3FA8EF',
        'sky-light' => '#8FCBF4',
        'sky-pale'  => '#DCEEFB',
        'mid'       => '#1D6FB8',
        'navy'      => '#0B2545',
        'navy-2'    => '#0E2F57',
        'slate'     => '#4D4D4D',
        'cool'      => '#6B7682',
        'line'      => '#DEE5EC',
        'mist'      => '#EEF3F7',
        'paper'     => '#F7FAFC',
        'white'     => '#FFFFFF',
        'ink'       => '#0D0D0D',
        'orange'    => '#F7941D',
        'orange-dk' => '#E07E0A',
    ),

    'fonts'            => array(
        'heading' => '"Source Serif 4", Georgia, serif',
        'body'    => '"Public Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        'google'  => 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=Public+Sans:wght@400;500;600;700;800&display=swap',
    ),

    /* ========================================================
     * Attorney / lead team member (legal vertical). For non-legal
     * verticals this is the owner / lead pro shown in the About section.
     * ====================================================== */
    'attorney_name'    => 'John Truskett',
    'attorney_title'   => 'Personal Injury Attorney',
    'attorney'         => array(
        'name'  => 'John Truskett',
        'title' => 'Personal Injury Attorney',
        'since' => '2004',
        'bio'   => 'John Truskett has focused his practice on personal injury law since graduating law school in 2004. The firm represents injured people and families across the Tulsa area on a contingency basis, which means clients pay no attorney fee unless the firm recovers compensation for them.',
    ),

    /* ========================================================
     * Image zones — WordPress attachment IDs populated by image_harvest
     * + the image mapping step. 0 means "not assigned"; the theme falls
     * back to the page featured image, then to a styled placeholder.
     * ====================================================== */
    'img_hero'         => 486, // "Truskett Accident Attorney" (also the front-page featured image)
    'img_attorney'     => 640, // John Truskett headshot (migrated from the old theme's bundled asset into the media library)
    'img_office'       => 484, // Truskett Law Office 8 of 19
    'img_lobby'        => 479, // Truskett Law Office 13 of 19
    'img_team'         => 603, // Tulsa Personal Injury Lawyers team photo

    /* ========================================================
     * Services (practice areas) — slug => label. Drive the services
     * dropdown fallback, the home practice grid, and related-service links.
     * ====================================================== */
    'services'         => array(
        'personal-injury'                   => 'Personal Injury',
        'motor-vehicle-accidents'           => 'Motor Vehicle Accidents',
        'semi-truck-accidents'              => 'Semi-Truck Accidents',
        'motorcycle-accidents'              => 'Motorcycle Accidents',
        'pedestrian-injury'                 => 'Pedestrian Injury',
        'slip-and-fall'                     => 'Slip and Fall',
        'nursing-home-negligence-and-abuse' => 'Nursing Home Negligence',
        'wrongful-death'                    => 'Wrongful Death',
        'birth-injury'                      => 'Birth Injury',
        'catastrophic-injury'               => 'Catastrophic Injury',
        'defective-products'                => 'Defective Products',
        'surgical-injury'                   => 'Surgical Injury',
        'animal-dog-bite-injury'            => 'Dog Bite Injury',
        'insurance-disputes'                => 'Insurance Disputes',
    ),

    /* The service given the "signature practice" feature slot in the nav
     * dropdown + home page. slug => headline/sub. */
    'signature_service' => array(
        'slug'  => 'semi-truck-accidents',
        'label' => 'Semi-Truck &amp; 18-Wheeler Wrecks',
        'note'  => 'Signature practice',
    ),

    /* ========================================================
     * Service areas (location pages) — slug => label.
     * ====================================================== */
    'locations'        => array(
        'tulsa'         => 'Tulsa',
        'broken-arrow'  => 'Broken Arrow',
        'owasso'        => 'Owasso',
        'jenks'         => 'Jenks',
        'sand-springs'  => 'Sand Springs',
        'claremore'     => 'Claremore',
        'bixby'         => 'Bixby',
        'sapulpa'       => 'Sapulpa',
        'glenpool'      => 'Glenpool',
        'coweta'        => 'Coweta',
        'catoosa'       => 'Catoosa',
        'collinsville'  => 'Collinsville',
        'skiatook'      => 'Skiatook',
        'wagoner'       => 'Wagoner',
        'inola'         => 'Inola',
        'fair-oaks'     => 'Fair Oaks',
        'avants'        => 'Avants',
        'beggs'         => 'Beggs',
    ),
    'region'           => 'Oklahoma',        // used in map queries and area copy
    'metro'            => 'the Tulsa metro',

    /* ========================================================
     * Lead form dropdown options. The theme picks the list that matches
     * 'vertical': legal -> case_types, home_services -> service_types.
     * ====================================================== */
    'case_types'       => array(
        'Car Accident',
        'Truck Accident',
        'Motorcycle Accident',
        'Pedestrian Injury',
        'Slip and Fall',
        'Nursing Home Abuse',
        'Wrongful Death',
        'Other Injury',
    ),
    'service_types'    => array(
        'Repair',
        'Installation',
        'Maintenance',
        'Emergency Service',
        'Free Estimate',
        'Other',
    ),

    /* ========================================================
     * Testimonials shown on the home page.
     * ====================================================== */
    'testimonials'     => array(
        array('text' => 'The insurance company denied my claim and my employer fired me after my crash. John fought for my rights and even won on appeal. They are real trial attorneys who care about people, not just money.', 'who' => 'Jon W., Tulsa'),
        array('text' => 'While other attorneys only call, Mr. Truskett took the time to meet with me in person and handled my injury case as a top priority. I recommend him to anyone.', 'who' => 'Fannie B., Tulsa'),
        array('text' => 'John is an amazing attorney. He has his client\'s best interest in mind when handling a case. I would gladly refer him any chance I get.', 'who' => 'Tiffany T., Tulsa'),
    ),

    /* ========================================================
     * Footer
     * ====================================================== */
    'footer_blurb'     => 'Truskett Law represents injured people and families across the Tulsa area, handling the legal side so you can focus on recovery. No fee unless we recover for you.',
    'footer_practice'  => array(
        'semi-truck-accidents'              => 'Semi-Truck Wrecks',
        'motor-vehicle-accidents'           => 'Car Wreck Injuries',
        'wrongful-death'                    => 'Wrongful Death',
        'catastrophic-injury'               => 'Catastrophic Injury',
        'nursing-home-negligence-and-abuse' => 'Nursing Home Negligence',
    ),
    'footer_legal'     => 'Attorney advertising. The information on this site is for general purposes only and is not legal advice. Viewing it does not create an attorney-client relationship. Prior results do not guarantee a similar outcome; every case is different.',
    'footer_credit'    => 'Site by McWilliams Media',
    'social'           => array(),
);
