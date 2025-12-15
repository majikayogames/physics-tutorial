from manim import *


class AngularMomentum(Scene):
    def construct(self):
        # Title
        title = Text(
            "Angular momentum:",
            font_size=60,
        )
        # Prevent title from going off-screen
        max_title_width = config.frame_width * 0.96
        if title.width > max_title_width:
            title.scale_to_fit_width(max_title_width)

        # Plain-language summary
        line1 = Text(
            "Rotational momentum (L) is the analogue of linear momentum",
            font_size=36,
        )
        line2 = Text(
            "It is conserved and equals I × angular velocity",
            font_size=36,
        )

        # Equations
        eq1 = MathTex(
            r"L = I \cdot \omega",
            font_size=64,
        )
        per_particle = Text(
            "Or for each particle:",
            font_size=34,
        )
        eq2 = MathTex(
            r"L = r \times (m v)",
            font_size=64,
        )
        line_sum = Text(
            "Summed over all particles (same as I calculation)",
            font_size=34,
        )
        line_same = Text(
            "Both give the same result.",
            font_size=36,
        )

        # Layout
        group_top = VGroup(title, line1, line2).arrange(DOWN, buff=0.5)
        group_eqs = VGroup(eq1, per_particle, eq2).arrange(DOWN, buff=0.5)
        group_bottom = VGroup(line_sum, line_same).arrange(DOWN, buff=0.5)

        all_groups = VGroup(group_top, group_eqs, group_bottom).arrange(DOWN, buff=0.6)
        max_total_height = config.frame_height * 0.9
        if all_groups.height > max_total_height:
            all_groups.scale_to_fit_height(max_total_height)
        all_groups.move_to(ORIGIN)

        # Animate
        self.play(FadeIn(title))
        self.wait(0.6)
        self.play(FadeIn(line1))
        self.wait(0.6)
        self.play(FadeIn(line2))
        self.wait(0.9)

        self.play(Write(eq1))
        self.wait(0.9)
        self.play(FadeIn(per_particle))
        self.play(Write(eq2))
        self.wait(0.9)

        self.play(FadeIn(line_sum))
        self.wait(0.6)
        self.play(FadeIn(line_same))
        self.wait(3.0)



