import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/**
 * CoreBlow Sovereign Signature Icon Set (React / Electron Desktop)
 * 1-to-1 visual parity with Web Control UI (ui/src/ui/icons.ts):
 * chamfered instrument silhouettes, core beacon dots, and subtle duotone accents.
 */

// Exact organic concentric vortex paths shared with coreblow-studio.svg (canonical CoreBlow brand mark)
const COREBLOW_VORTEX_PATHS = (
  <>
    <path d="M 426.91 172.69 L 436.79 170.81 L 446.70 169.21 L 456.65 167.88 L 466.61 166.84 L 476.59 166.08 L 486.58 165.60 L 496.56 165.40 L 506.53 165.48 L 516.49 165.84 L 526.42 166.47 L 536.31 167.38 L 546.16 168.57 L 555.97 170.04 L 565.72 171.77 L 575.40 173.78 L 585.01 176.05 L 594.55 178.59 L 603.99 181.39 L 613.34 184.45 L 622.60 187.77 L 631.74 191.35 L 640.77 195.17 L 649.68 199.24 L 658.45 203.55 L 667.10 208.11 L 675.60 212.89 L 683.95 217.91 L 692.15 223.15 L 700.19 228.62 L 708.06 234.30 L 715.76 240.19 L 723.28 246.29 L 730.62 252.58 L 737.77 259.08 L 744.72 265.76 L 751.48 272.63 L 758.03 279.67 L 764.37 286.89 L 770.50 294.27 L 776.41 301.81 L 782.10 309.50 L 787.57 317.34 L 792.80 325.33 L 797.81 333.44 L 802.57 341.68 L 807.10 350.04 L 811.38 358.51 L 815.42 367.09 L 819.22 375.77 L 822.76 384.53 L 826.04 393.38 L 829.08 402.31 L 831.86 411.31 L 834.38 420.37 L 836.64 429.48 L 838.64 438.65 L 840.38 447.85 L 841.86 457.08 L 843.08 466.34 L 844.03 475.62 L 844.72 484.90 L 845.15 494.19 L 845.32 503.48 L 845.22 512.75 L 844.86 522.00 L 844.25 531.22 L 843.37 540.41 L 842.24 549.56 L 840.86 558.66 L 839.22 567.71 L 837.32 576.69 L 835.18 585.60 L 832.79 594.43 L 830.16 603.18 L 827.28 611.83 L 824.17 620.39 L 820.82 628.85 L 817.24 637.19 L 813.42 645.41 L 809.39 653.51 L 805.13 661.49 L 800.65 669.32 L 795.97 677.01 L 791.07 684.56 L 785.97 691.95 L 780.67 699.17 L 775.17 706.24 L 769.49 713.13 L 763.62 719.85 L 757.57 726.38 L 751.35 732.73 L 744.96 738.89 L 738.41 744.85 L 731.70 750.61 L 724.84 756.16 L 717.84 761.51 L 710.70 766.64 L 703.42 771.55 L 696.02 776.24 L 688.50 780.70 L 680.86 784.93 L 673.12 788.92 L 665.28 792.67 L 657.34 796.18 L 649.31 799.43 L 641.21 802.42 L 633.02 805.14 L 624.77 807.57 L 616.43 809.66 L 607.94 811.12 L 607.94 811.12 L 615.66 807.49 L 623.39 804.03 L 631.05 800.46 L 638.62 796.73 L 646.09 792.83 L 653.46 788.76 L 660.71 784.51 L 667.84 780.07 L 674.85 775.46 L 681.73 770.67 L 688.47 765.70 L 695.08 760.56 L 701.54 755.25 L 707.85 749.77 L 714.00 744.13 L 720.00 738.32 L 725.83 732.36 L 731.50 726.24 L 736.99 719.98 L 742.31 713.57 L 747.45 707.03 L 752.40 700.35 L 757.17 693.54 L 761.74 686.60 L 766.12 679.54 L 770.31 672.38 L 774.29 665.10 L 778.07 657.71 L 781.65 650.23 L 785.01 642.66 L 788.16 635.00 L 791.10 627.26 L 793.83 619.45 L 796.34 611.56 L 798.62 603.61 L 800.69 595.61 L 802.53 587.55 L 804.15 579.45 L 805.54 571.31 L 806.71 563.14 L 807.65 554.94 L 808.37 546.72 L 808.85 538.48 L 809.11 530.24 L 809.14 522.00 L 808.94 513.76 L 808.51 505.53 L 807.85 497.32 L 806.97 489.14 L 805.86 480.98 L 804.52 472.86 L 802.97 464.78 L 801.18 456.75 L 799.18 448.78 L 796.96 440.86 L 794.51 433.02 L 791.86 425.24 L 788.98 417.54 L 785.90 409.93 L 782.60 402.41 L 779.10 394.98 L 775.40 387.66 L 771.49 380.44 L 767.39 373.34 L 763.09 366.35 L 758.60 359.49 L 753.92 352.76 L 749.06 346.16 L 744.01 339.69 L 738.79 333.38 L 733.40 327.21 L 727.84 321.19 L 722.11 315.34 L 716.23 309.64 L 710.19 304.11 L 703.99 298.76 L 697.66 293.58 L 691.18 288.57 L 684.57 283.75 L 677.82 279.12 L 670.96 274.68 L 663.97 270.43 L 656.87 266.37 L 649.65 262.52 L 642.34 258.87 L 634.92 255.42 L 627.42 252.19 L 619.83 249.16 L 612.16 246.34 L 604.41 243.75 L 596.60 241.36 L 588.72 239.20 L 580.79 237.26 L 572.80 235.53 L 564.78 234.04 L 556.71 232.76 L 548.61 231.71 L 540.49 230.89 L 532.35 230.29 L 524.20 229.92 L 516.04 229.78 L 507.88 229.87 L 499.73 230.18 L 491.59 230.72 L 483.47 231.48 L 475.37 232.47 L 467.30 233.69 L 459.28 235.13 L 451.29 236.79 L 443.36 238.67 A 34.00 34.00 0 0 1 426.91 172.69 Z" />
    <path d="M 162.94 561.11 L 164.13 568.22 L 165.46 575.31 L 166.93 582.36 L 168.55 589.37 L 170.30 596.33 L 172.20 603.26 L 174.23 610.13 L 176.40 616.96 L 178.71 623.73 L 181.16 630.45 L 183.74 637.11 L 186.45 643.71 L 189.29 650.25 L 192.26 656.71 L 195.37 663.11 L 198.59 669.44 L 201.95 675.70 L 205.42 681.87 L 209.02 687.97 L 212.74 693.99 L 216.58 699.92 L 220.53 705.77 L 224.60 711.53 L 228.78 717.20 L 233.07 722.78 L 237.47 728.26 L 241.98 733.64 L 246.59 738.93 L 251.30 744.11 L 256.12 749.19 L 261.03 754.17 L 266.03 759.03 L 271.13 763.79 L 276.32 768.44 L 281.60 772.98 L 286.96 777.40 L 292.41 781.71 L 297.94 785.90 L 303.54 789.97 L 309.23 793.92 L 314.98 797.74 L 320.81 801.45 L 326.70 805.03 L 332.66 808.49 L 338.68 811.81 L 344.77 815.01 L 350.91 818.08 L 357.10 821.02 L 363.35 823.83 L 369.64 826.51 L 375.98 829.06 L 382.37 831.47 L 388.79 833.74 L 395.26 835.88 L 401.75 837.89 L 408.28 839.76 L 414.84 841.49 L 421.43 843.08 L 428.04 844.54 L 434.67 845.86 L 441.31 847.04 L 447.97 848.08 L 454.65 848.99 L 461.33 849.75 L 468.02 850.38 L 474.71 850.86 L 481.40 851.21 L 488.09 851.42 L 494.77 851.49 L 501.44 851.42 L 508.11 851.22 L 514.76 850.88 L 521.39 850.40 L 528.00 849.78 L 534.59 849.03 L 541.15 848.14 L 547.68 847.12 L 554.18 845.96 L 560.65 844.67 L 567.08 843.25 L 573.48 841.70 L 579.82 840.01 L 586.13 838.20 L 592.38 836.26 L 598.59 834.19 L 604.74 831.99 L 610.83 829.67 L 616.87 827.22 L 622.84 824.65 L 628.75 821.96 L 634.59 819.15 L 640.37 816.22 L 646.07 813.17 L 651.69 810.01 L 657.24 806.73 L 662.71 803.33 L 668.09 799.83 L 673.39 796.21 L 678.60 792.49 L 683.72 788.66 L 688.74 784.72 L 693.67 780.67 L 698.49 776.52 L 703.21 772.27 L 707.81 767.91 L 712.30 763.44 L 716.65 758.86 L 720.87 754.16 L 724.91 749.32 L 728.57 744.12 L 728.57 744.12 L 723.39 747.68 L 718.42 751.41 L 713.45 755.11 L 708.45 758.74 L 703.40 762.30 L 698.31 765.78 L 693.17 769.16 L 687.98 772.45 L 682.73 775.64 L 677.43 778.74 L 672.09 781.73 L 666.69 784.62 L 661.25 787.41 L 655.75 790.09 L 650.22 792.66 L 644.63 795.12 L 639.01 797.48 L 633.35 799.72 L 627.64 801.85 L 621.91 803.87 L 616.13 805.77 L 610.33 807.56 L 604.49 809.24 L 598.63 810.80 L 592.74 812.24 L 586.83 813.56 L 580.90 814.77 L 574.95 815.86 L 568.98 816.83 L 562.99 817.68 L 557.00 818.41 L 550.99 819.02 L 544.98 819.51 L 538.96 819.89 L 532.93 820.14 L 526.91 820.27 L 520.89 820.28 L 514.87 820.17 L 508.86 819.95 L 502.86 819.60 L 496.87 819.13 L 490.89 818.54 L 484.93 817.84 L 478.98 817.01 L 473.06 816.07 L 467.16 815.01 L 461.28 813.83 L 455.44 812.53 L 449.62 811.12 L 443.83 809.59 L 438.08 807.95 L 432.36 806.19 L 426.69 804.32 L 421.05 802.33 L 415.46 800.24 L 409.91 798.03 L 404.41 795.71 L 398.96 793.29 L 393.56 790.75 L 388.22 788.11 L 382.93 785.36 L 377.70 782.51 L 372.54 779.56 L 367.43 776.50 L 362.39 773.34 L 357.41 770.08 L 352.50 766.72 L 347.67 763.27 L 342.90 759.72 L 338.21 756.08 L 333.60 752.34 L 329.06 748.51 L 324.61 744.60 L 320.23 740.59 L 315.94 736.50 L 311.73 732.33 L 307.61 728.07 L 303.57 723.74 L 299.63 719.32 L 295.78 714.83 L 292.02 710.26 L 288.35 705.61 L 284.78 700.90 L 281.30 696.11 L 277.93 691.26 L 274.65 686.35 L 271.48 681.36 L 268.40 676.32 L 265.44 671.22 L 262.57 666.06 L 259.81 660.84 L 257.16 655.58 L 254.61 650.26 L 252.17 644.89 L 249.85 639.48 L 247.63 634.02 L 245.52 628.52 L 243.53 622.97 L 241.65 617.40 L 239.88 611.78 L 238.23 606.14 L 236.69 600.46 L 235.27 594.75 L 233.96 589.02 L 232.77 583.26 L 231.70 577.49 L 230.74 571.69 L 229.91 565.88 L 229.19 560.05 L 228.58 554.21 A 33.00 33.00 0 0 0 162.94 561.11 Z" />
    <path d="M 764.00 528.00 A 246 246 0 1 0 272.00 528.00 A 246 246 0 1 0 764.00 528.00 Z M 738.00 544.00 A 198 198 0 1 1 342.00 544.00 A 198 198 0 1 1 738.00 544.00 Z" />
    <path d="M 696.00 540.00 A 164 164 0 1 0 368.00 540.00 A 164 164 0 1 0 696.00 540.00 Z M 648.00 526.00 A 130 130 0 1 1 388.00 526.00 A 130 130 0 1 1 648.00 526.00 Z" />
  </>
);

// CoreBlow Sovereign Organic Vortex Emblem (monochrome vector mark for small UI slots & agent badges)
export const CoreBlowEmblem: React.FC<IconProps> = ({
  size = 20,
  color = "currentColor",
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="132 136 744 744"
    fill={color}
    fillRule="evenodd"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {COREBLOW_VORTEX_PATHS}
  </svg>
);

// CoreBlow Glossy Orange & Metallic Charcoal Swirl (canonical in-app brand emblem)
export const CoreBlowBrandSwirl: React.FC<IconProps> = ({ size = 64, className }) => {
  const uid = React.useId().replace(/:/g, "");
  const g1 = `cb-swirl-g1-${uid}`;
  const g2 = `cb-swirl-g2-${uid}`;
  const g3 = `cb-swirl-g3-${uid}`;
  const g4 = `cb-swirl-g4-${uid}`;
  const gloss = `cb-swirl-gloss-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="132 136 744 744"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={g1} x1="25%" y1="5%" x2="88%" y2="92%">
          <stop offset="0%" stopColor="#FFA242" />
          <stop offset="22%" stopColor="#FF6805" />
          <stop offset="62%" stopColor="#EB3E00" />
          <stop offset="100%" stopColor="#B82200" />
        </linearGradient>
        <linearGradient id={g2} x1="8%" y1="20%" x2="88%" y2="85%">
          <stop offset="0%" stopColor="#FFA445" />
          <stop offset="24%" stopColor="#FF6400" />
          <stop offset="44%" stopColor="#D63500" />
          <stop offset="56%" stopColor="#7A8792" />
          <stop offset="76%" stopColor="#3B454E" />
          <stop offset="100%" stopColor="#242C33" />
        </linearGradient>
        <linearGradient id={g3} x1="15%" y1="75%" x2="82%" y2="18%">
          <stop offset="0%" stopColor="#D43000" />
          <stop offset="26%" stopColor="#FF6200" />
          <stop offset="44%" stopColor="#FFA448" />
          <stop offset="56%" stopColor="#94A1AC" />
          <stop offset="76%" stopColor="#414C56" />
          <stop offset="100%" stopColor="#252D34" />
        </linearGradient>
        <linearGradient id={g4} x1="85%" y1="30%" x2="15%" y2="75%">
          <stop offset="0%" stopColor="#FF9632" />
          <stop offset="28%" stopColor="#FF5500" />
          <stop offset="48%" stopColor="#C92B00" />
          <stop offset="60%" stopColor="#818E99" />
          <stop offset="80%" stopColor="#3A444D" />
          <stop offset="100%" stopColor="#242B32" />
        </linearGradient>
        <linearGradient id={gloss} x1="20%" y1="0%" x2="75%" y2="85%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      <g fillRule="evenodd">
        <path
          d="M 426.91 172.69 L 436.79 170.81 L 446.70 169.21 L 456.65 167.88 L 466.61 166.84 L 476.59 166.08 L 486.58 165.60 L 496.56 165.40 L 506.53 165.48 L 516.49 165.84 L 526.42 166.47 L 536.31 167.38 L 546.16 168.57 L 555.97 170.04 L 565.72 171.77 L 575.40 173.78 L 585.01 176.05 L 594.55 178.59 L 603.99 181.39 L 613.34 184.45 L 622.60 187.77 L 631.74 191.35 L 640.77 195.17 L 649.68 199.24 L 658.45 203.55 L 667.10 208.11 L 675.60 212.89 L 683.95 217.91 L 692.15 223.15 L 700.19 228.62 L 708.06 234.30 L 715.76 240.19 L 723.28 246.29 L 730.62 252.58 L 737.77 259.08 L 744.72 265.76 L 751.48 272.63 L 758.03 279.67 L 764.37 286.89 L 770.50 294.27 L 776.41 301.81 L 782.10 309.50 L 787.57 317.34 L 792.80 325.33 L 797.81 333.44 L 802.57 341.68 L 807.10 350.04 L 811.38 358.51 L 815.42 367.09 L 819.22 375.77 L 822.76 384.53 L 826.04 393.38 L 829.08 402.31 L 831.86 411.31 L 834.38 420.37 L 836.64 429.48 L 838.64 438.65 L 840.38 447.85 L 841.86 457.08 L 843.08 466.34 L 844.03 475.62 L 844.72 484.90 L 845.15 494.19 L 845.32 503.48 L 845.22 512.75 L 844.86 522.00 L 844.25 531.22 L 843.37 540.41 L 842.24 549.56 L 840.86 558.66 L 839.22 567.71 L 837.32 576.69 L 835.18 585.60 L 832.79 594.43 L 830.16 603.18 L 827.28 611.83 L 824.17 620.39 L 820.82 628.85 L 817.24 637.19 L 813.42 645.41 L 809.39 653.51 L 805.13 661.49 L 800.65 669.32 L 795.97 677.01 L 791.07 684.56 L 785.97 691.95 L 780.67 699.17 L 775.17 706.24 L 769.49 713.13 L 763.62 719.85 L 757.57 726.38 L 751.35 732.73 L 744.96 738.89 L 738.41 744.85 L 731.70 750.61 L 724.84 756.16 L 717.84 761.51 L 710.70 766.64 L 703.42 771.55 L 696.02 776.24 L 688.50 780.70 L 680.86 784.93 L 673.12 788.92 L 665.28 792.67 L 657.34 796.18 L 649.31 799.43 L 641.21 802.42 L 633.02 805.14 L 624.77 807.57 L 616.43 809.66 L 607.94 811.12 L 607.94 811.12 L 615.66 807.49 L 623.39 804.03 L 631.05 800.46 L 638.62 796.73 L 646.09 792.83 L 653.46 788.76 L 660.71 784.51 L 667.84 780.07 L 674.85 775.46 L 681.73 770.67 L 688.47 765.70 L 695.08 760.56 L 701.54 755.25 L 707.85 749.77 L 714.00 744.13 L 720.00 738.32 L 725.83 732.36 L 731.50 726.24 L 736.99 719.98 L 742.31 713.57 L 747.45 707.03 L 752.40 700.35 L 757.17 693.54 L 761.74 686.60 L 766.12 679.54 L 770.31 672.38 L 774.29 665.10 L 778.07 657.71 L 781.65 650.23 L 785.01 642.66 L 788.16 635.00 L 791.10 627.26 L 793.83 619.45 L 796.34 611.56 L 798.62 603.61 L 800.69 595.61 L 802.53 587.55 L 804.15 579.45 L 805.54 571.31 L 806.71 563.14 L 807.65 554.94 L 808.37 546.72 L 808.85 538.48 L 809.11 530.24 L 809.14 522.00 L 808.94 513.76 L 808.51 505.53 L 807.85 497.32 L 806.97 489.14 L 805.86 480.98 L 804.52 472.86 L 802.97 464.78 L 801.18 456.75 L 799.18 448.78 L 796.96 440.86 L 794.51 433.02 L 791.86 425.24 L 788.98 417.54 L 785.90 409.93 L 782.60 402.41 L 779.10 394.98 L 775.40 387.66 L 771.49 380.44 L 767.39 373.34 L 763.09 366.35 L 758.60 359.49 L 753.92 352.76 L 749.06 346.16 L 744.01 339.69 L 738.79 333.38 L 733.40 327.21 L 727.84 321.19 L 722.11 315.34 L 716.23 309.64 L 710.19 304.11 L 703.99 298.76 L 697.66 293.58 L 691.18 288.57 L 684.57 283.75 L 677.82 279.12 L 670.96 274.68 L 663.97 270.43 L 656.87 266.37 L 649.65 262.52 L 642.34 258.87 L 634.92 255.42 L 627.42 252.19 L 619.83 249.16 L 612.16 246.34 L 604.41 243.75 L 596.60 241.36 L 588.72 239.20 L 580.79 237.26 L 572.80 235.53 L 564.78 234.04 L 556.71 232.76 L 548.61 231.71 L 540.49 230.89 L 532.35 230.29 L 524.20 229.92 L 516.04 229.78 L 507.88 229.87 L 499.73 230.18 L 491.59 230.72 L 483.47 231.48 L 475.37 232.47 L 467.30 233.69 L 459.28 235.13 L 451.29 236.79 L 443.36 238.67 A 34.00 34.00 0 0 1 426.91 172.69 Z"
          fill={`url(#${g1})`}
        />
        <path
          d="M 162.94 561.11 L 164.13 568.22 L 165.46 575.31 L 166.93 582.36 L 168.55 589.37 L 170.30 596.33 L 172.20 603.26 L 174.23 610.13 L 176.40 616.96 L 178.71 623.73 L 181.16 630.45 L 183.74 637.11 L 186.45 643.71 L 189.29 650.25 L 192.26 656.71 L 195.37 663.11 L 198.59 669.44 L 201.95 675.70 L 205.42 681.87 L 209.02 687.97 L 212.74 693.99 L 216.58 699.92 L 220.53 705.77 L 224.60 711.53 L 228.78 717.20 L 233.07 722.78 L 237.47 728.26 L 241.98 733.64 L 246.59 738.93 L 251.30 744.11 L 256.12 749.19 L 261.03 754.17 L 266.03 759.03 L 271.13 763.79 L 276.32 768.44 L 281.60 772.98 L 286.96 777.40 L 292.41 781.71 L 297.94 785.90 L 303.54 789.97 L 309.23 793.92 L 314.98 797.74 L 320.81 801.45 L 326.70 805.03 L 332.66 808.49 L 338.68 811.81 L 344.77 815.01 L 350.91 818.08 L 357.10 821.02 L 363.35 823.83 L 369.64 826.51 L 375.98 829.06 L 382.37 831.47 L 388.79 833.74 L 395.26 835.88 L 401.75 837.89 L 408.28 839.76 L 414.84 841.49 L 421.43 843.08 L 428.04 844.54 L 434.67 845.86 L 441.31 847.04 L 447.97 848.08 L 454.65 848.99 L 461.33 849.75 L 468.02 850.38 L 474.71 850.86 L 481.40 851.21 L 488.09 851.42 L 494.77 851.49 L 501.44 851.42 L 508.11 851.22 L 514.76 850.88 L 521.39 850.40 L 528.00 849.78 L 534.59 849.03 L 541.15 848.14 L 547.68 847.12 L 554.18 845.96 L 560.65 844.67 L 567.08 843.25 L 573.48 841.70 L 579.82 840.01 L 586.13 838.20 L 592.38 836.26 L 598.59 834.19 L 604.74 831.99 L 610.83 829.67 L 616.87 827.22 L 622.84 824.65 L 628.75 821.96 L 634.59 819.15 L 640.37 816.22 L 646.07 813.17 L 651.69 810.01 L 657.24 806.73 L 662.71 803.33 L 668.09 799.83 L 673.39 796.21 L 678.60 792.49 L 683.72 788.66 L 688.74 784.72 L 693.67 780.67 L 698.49 776.52 L 703.21 772.27 L 707.81 767.91 L 712.30 763.44 L 716.65 758.86 L 720.87 754.16 L 724.91 749.32 L 728.57 744.12 L 728.57 744.12 L 723.39 747.68 L 718.42 751.41 L 713.45 755.11 L 708.45 758.74 L 703.40 762.30 L 698.31 765.78 L 693.17 769.16 L 687.98 772.45 L 682.73 775.64 L 677.43 778.74 L 672.09 781.73 L 666.69 784.62 L 661.25 787.41 L 655.75 790.09 L 650.22 792.66 L 644.63 795.12 L 639.01 797.48 L 633.35 799.72 L 627.64 801.85 L 621.91 803.87 L 616.13 805.77 L 610.33 807.56 L 604.49 809.24 L 598.63 810.80 L 592.74 812.24 L 586.83 813.56 L 580.90 814.77 L 574.95 815.86 L 568.98 816.83 L 562.99 817.68 L 557.00 818.41 L 550.99 819.02 L 544.98 819.51 L 538.96 819.89 L 532.93 820.14 L 526.91 820.27 L 520.89 820.28 L 514.87 820.17 L 508.86 819.95 L 502.86 819.60 L 496.87 819.13 L 490.89 818.54 L 484.93 817.84 L 478.98 817.01 L 473.06 816.07 L 467.16 815.01 L 461.28 813.83 L 455.44 812.53 L 449.62 811.12 L 443.83 809.59 L 438.08 807.95 L 432.36 806.19 L 426.69 804.32 L 421.05 802.33 L 415.46 800.24 L 409.91 798.03 L 404.41 795.71 L 398.96 793.29 L 393.56 790.75 L 388.22 788.11 L 382.93 785.36 L 377.70 782.51 L 372.54 779.56 L 367.43 776.50 L 362.39 773.34 L 357.41 770.08 L 352.50 766.72 L 347.67 763.27 L 342.90 759.72 L 338.21 756.08 L 333.60 752.34 L 329.06 748.51 L 324.61 744.60 L 320.23 740.59 L 315.94 736.50 L 311.73 732.33 L 307.61 728.07 L 303.57 723.74 L 299.63 719.32 L 295.78 714.83 L 292.02 710.26 L 288.35 705.61 L 284.78 700.90 L 281.30 696.11 L 277.93 691.26 L 274.65 686.35 L 271.48 681.36 L 268.40 676.32 L 265.44 671.22 L 262.57 666.06 L 259.81 660.84 L 257.16 655.58 L 254.61 650.26 L 252.17 644.89 L 249.85 639.48 L 247.63 634.02 L 245.52 628.52 L 243.53 622.97 L 241.65 617.40 L 239.88 611.78 L 238.23 606.14 L 236.69 600.46 L 235.27 594.75 L 233.96 589.02 L 232.77 583.26 L 231.70 577.49 L 230.74 571.69 L 229.91 565.88 L 229.19 560.05 L 228.58 554.21 A 33.00 33.00 0 0 0 162.94 561.11 Z"
          fill={`url(#${g2})`}
        />
        <path
          d="M 764.00 528.00 A 246 246 0 1 0 272.00 528.00 A 246 246 0 1 0 764.00 528.00 Z M 738.00 544.00 A 198 198 0 1 1 342.00 544.00 A 198 198 0 1 1 738.00 544.00 Z"
          fill={`url(#${g3})`}
        />
        <path
          d="M 696.00 540.00 A 164 164 0 1 0 368.00 540.00 A 164 164 0 1 0 696.00 540.00 Z M 648.00 526.00 A 130 130 0 1 1 388.00 526.00 A 130 130 0 1 1 648.00 526.00 Z"
          fill={`url(#${g4})`}
        />
      </g>
      <g fill={`url(#${gloss})`} fillRule="evenodd">
        {COREBLOW_VORTEX_PATHS}
      </g>
    </svg>
  );
};

// CoreBlow Full Brand App Icon (Solid Core Orange squircle + pure-white organic vortex for hero & about views)
export const CoreBlowAppIcon: React.FC<IconProps> = ({ size = 64, className }) => {
  const uid = React.useId().replace(/:/g, "");
  const bgId = `cb-hero-bg-${uid}`;
  const rimId = `cb-hero-rim-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="40 40 944 944"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={bgId} x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#FF6D1A" />
          <stop offset="50%" stopColor="#EA4E14" />
          <stop offset="100%" stopColor="#C83406" />
        </linearGradient>
        <linearGradient id={rimId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <rect x="40" y="40" width="944" height="944" rx="220" fill={`url(#${bgId})`} />
      <rect
        x="44"
        y="44"
        width="936"
        height="936"
        rx="216"
        fill="none"
        stroke={`url(#${rimId})`}
        strokeWidth="4"
      />
      <g fill="#FFFFFF" fillRule="evenodd">
        {COREBLOW_VORTEX_PATHS}
      </g>
    </svg>
  );
};

export const PlusIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 6h17" />
    <path d="M18.5 6v13.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6" fill={color} fillOpacity="0.1" />
    <path d="M8.5 6V4a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 4v2" />
    <line x1="10" y1="10.5" x2="10" y2="16.5" />
    <line x1="14" y1="10.5" x2="14" y2="16.5" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="7.5" fill={color} fillOpacity="0.1" />
    <line x1="20.5" y1="20.5" x2="16.4" y2="16.4" />
  </svg>
);

// Config / Settings — precision chamfered hex vernier dial
export const SettingsIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3.2h8l4.8 4.8v8L16 20.8H8L3.2 16V8z" fill={color} fillOpacity="0.12" />
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="8" x2="12" y2="5.5" />
    <circle cx="12" cy="12" r="1.3" fill={color} stroke="none" />
  </svg>
);

export const SidebarToggleIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill={color} fillOpacity="0.08" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

export const InspectorIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill={color} fillOpacity="0.08" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill={color} fillOpacity="0.1" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const GitBranchIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" fill={color} fillOpacity="0.14" />
    <circle cx="6" cy="18" r="3" fill={color} fillOpacity="0.14" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M21 18.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4.5l2 2.5H19a2 2 0 0 1 2 2z"
      fill={color}
      fillOpacity="0.12"
    />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M12 21.5s7.5-3.8 7.5-9.5V5.5L12 2.5l-7.5 3V12c0 5.7 7.5 9.5 7.5 9.5z"
      fill={color}
      fillOpacity="0.14"
    />
    <polyline points="9 12 11 14 15 9.8" />
  </svg>
);

// Models — stacked isometric neural inference layers
export const SparklesIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 3.2 20.5 7.8 12 12.4 3.5 7.8 12 3.2" fill={color} fillOpacity="0.16" />
    <polyline points="3.5 12.2 12 16.8 20.5 12.2" />
    <polyline points="3.5 16.4 12 21 20.5 16.4" />
  </svg>
);

export const TerminalIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 4 22 10 16 10" />
    <polyline points="2 20 2 14 8 14" />
    <path d="M3.8 9a8.5 8.5 0 0 1 14.3-3.1L22 10M2 14l3.9 4.1A8.5 8.5 0 0 0 20.2 15" />
  </svg>
);

export const MicIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="3" width="6" height="10.5" rx="3" fill={color} fillOpacity="0.16" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <line x1="12" y1="18" x2="12" y2="21" />
    <line x1="9" y1="21" x2="15" y2="21" />
  </svg>
);

export const SpeakerIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={color} fillOpacity="0.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const VolumeXIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={color} fillOpacity="0.14" />
    <line x1="22" y1="9" x2="16" y2="15" />
    <line x1="16" y1="9" x2="22" y2="15" />
  </svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="7.5" r="3.5" fill={color} fillOpacity="0.14" />
    <path d="M15.5 20.5v-1.8a3.8 3.8 0 0 0-3.8-3.8H6.3a3.8 3.8 0 0 0-3.8 3.8v1.8" />
    <circle cx="17" cy="8.5" r="2.5" />
    <path d="M21.5 20.5v-1.5a3 3 0 0 0-2.5-3" />
  </svg>
);

export const PinIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="17" x2="12" y2="22" />
    <path
      d="M5 17h14v-2l-2-3V5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v7l-2 3v2z"
      fill={color}
      fillOpacity="0.14"
    />
  </svg>
);

// AI Agents / War Room Squad — sovereign hex core with orbital squad halo
export const AgentsBrainIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 6.8L16.2 9.2v4.8L12 16.4 7.8 14V9.2z" fill={color} fillOpacity="0.2" />
    <circle cx="12" cy="11.6" r="1.3" fill={color} stroke="none" />
    <path d="M4.2 14.5A8.5 8.5 0 0 1 12 3.2a8.5 8.5 0 0 1 7.8 11.3" strokeOpacity="0.55" />
    <circle cx="5.2" cy="17.8" r="1.7" />
    <circle cx="12" cy="20" r="1.7" />
    <circle cx="18.8" cy="17.8" r="1.7" />
  </svg>
);

// Capabilities 4-point diamond sparkle
export const DiamondSparkIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
  </svg>
);

// Skills — sovereign capability microchip with 4-point neural spark core
export const SkillsChipIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="6" y="6" width="12" height="12" rx="2.8" fill={color} fillOpacity="0.14" />
    <path d="M12 8.7l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill={color} stroke="none" />
    <line x1="9.5" y1="3" x2="9.5" y2="6" />
    <line x1="14.5" y1="3" x2="14.5" y2="6" />
    <line x1="9.5" y1="18" x2="9.5" y2="21" />
    <line x1="14.5" y1="18" x2="14.5" y2="21" />
    <line x1="3" y1="9.5" x2="6" y2="9.5" />
    <line x1="3" y1="14.5" x2="6" y2="14.5" />
    <line x1="18" y1="9.5" x2="21" y2="9.5" />
    <line x1="18" y1="14.5" x2="21" y2="14.5" />
  </svg>
);

// Memory — stylized dual-hemisphere brain
export const MemoryBrainIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M9.5 4.5a3 3 0 0 0-3 2.7A3.2 3.2 0 0 0 4 10.3a3.1 3.1 0 0 0 1.4 2.6A3.2 3.2 0 0 0 6.8 18a3 3 0 0 0 2.7 1.7c1.4 0 2.5-1.1 2.5-2.5V7a2.5 2.5 0 0 0-2.5-2.5z"
      fill={color}
      fillOpacity="0.14"
    />
    <path
      d="M14.5 4.5a3 3 0 0 1 3 2.7A3.2 3.2 0 0 1 20 10.3a3.1 3.1 0 0 1-1.4 2.6A3.2 3.2 0 0 1 17.2 18a3 3 0 0 1-2.7 1.7c-1.4 0-2.5-1.1-2.5-2.5V7a2.5 2.5 0 0 1 2.5-2.5z"
      fill={color}
      fillOpacity="0.14"
    />
    <path d="M9.5 9.5a2 2 0 0 1-2 1.8" />
    <path d="M14.5 9.5a2 2 0 0 0 2 1.8" />
    <path d="M9.5 14.5a2 2 0 0 0-1.8 1.2" />
    <path d="M14.5 14.5a2 2 0 0 1 1.8 1.2" />
  </svg>
);

// Cron Jobs / Scheduled Automations — precision chronograph timer dial
export const ClockIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="13" r="7.5" fill={color} fillOpacity="0.12" />
    <line x1="9.5" y1="2.8" x2="14.5" y2="2.8" />
    <line x1="12" y1="2.8" x2="12" y2="5.5" />
    <polyline points="12 9 12 13 15 14.8" />
    <circle cx="12" cy="13" r="1.1" fill={color} stroke="none" />
  </svg>
);

// Channels — live broadcast signal waves
export const RadioIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="2" fill={color} />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

// MCP — CoreBlow S-curve protocol node conduit with duotone core beacons
export const McpConduitIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="6" cy="6" r="3" fill={color} fillOpacity="0.16" />
    <circle cx="6" cy="6" r="1" fill={color} stroke="none" />
    <circle cx="18" cy="18" r="3" fill={color} fillOpacity="0.16" />
    <circle cx="18" cy="18" r="1" fill={color} stroke="none" />
    <path d="M9 6a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3" />
  </svg>
);

// Remote Nodes — dual rack server daemon blades
export const ServerIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="6.5" rx="1.8" fill={color} fillOpacity="0.14" />
    <rect x="3" y="13.5" width="18" height="6.5" rx="1.8" fill={color} fillOpacity="0.1" />
    <circle cx="7" cy="7.25" r="1" fill={color} stroke="none" />
    <circle cx="7" cy="16.75" r="1" fill={color} stroke="none" />
    <line x1="11" y1="7.25" x2="17.5" y2="7.25" />
    <line x1="11" y1="16.75" x2="17.5" y2="16.75" />
  </svg>
);

// Usage & Metrics — ascending telemetry area-sparkline with peak beacon
export const ActivityIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 19.5h17" strokeOpacity="0.55" />
    <path
      d="M4.5 15.5l4.2-4.2 3.3 2.7 5.8-7.2V19.5H4.5z"
      fill={color}
      fillOpacity="0.14"
      stroke="none"
    />
    <path d="M4.5 15.5l4.2-4.2 3.3 2.7 5.8-7.2" />
    <circle cx="17.8" cy="6.8" r="1.8" fill={color} stroke="none" />
    <circle cx="8.7" cy="11.3" r="1.1" fill={color} stroke="none" />
  </svg>
);

// CoreHub — interlocking hexagonal module vault with snapping node
export const CoreHubIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.5 3.2L16.5 6.6v6.8l-6 3.4-6-3.4V6.6z" fill={color} fillOpacity="0.14" />
    <path d="M16.5 11.2l4 2.3v4.6l-4 2.3-4-2.3v-2.1" fill={color} fillOpacity="0.18" />
    <circle cx="10.5" cy="10" r="1.6" fill={color} stroke="none" />
  </svg>
);

// Compass — navigation instrument with 4-point needle
export const CompassIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.08" />
    <polygon
      points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
      fill={color}
      fillOpacity="0.2"
    />
    <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
  </svg>
);

// Globe — network navigation sphere with latitude/longitude meridians
export const GlobeIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.08" />
    <path d="M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18z" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

// GridTools — 2x2 modular tool suite matrix
export const GridToolsIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.12" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.12" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.12" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.12" />
  </svg>
);

// ExpandPane — bidirectional expand / collapse pane
export const ExpandPaneIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

// SplitPane — vertical dual-pane toggle
export const SplitPaneIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="16" rx="2" fill={color} fillOpacity="0.08" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

export const FolderPlusIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
      fill={color}
      fillOpacity="0.08"
    />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

export const EditIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9" />
    <path
      d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
      fill={color}
      fillOpacity="0.08"
    />
  </svg>
);

export const ScreenIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill={color} fillOpacity="0.08" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const EyeOffIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const KeyIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m21 2-2 2m-1.5 1.5L19 7l-2 2-2-2-1.5 1.5" />
    <circle cx="7.5" cy="16.5" r="5.5" />
    <path d="m11.5 12.5 8-8" />
  </svg>
);
