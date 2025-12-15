from manim import *


class MassRadiusSquared(Scene):
    def construct(self):
        # Title
        title = Text(
            "Torque, angular acceleration, and moment of inertia:",
            font_size=60,
        )
        # Prevent title from going off-screen on narrower aspect ratios
        max_title_width = config.frame_width * 0.96
        if title.width > max_title_width:
            title.scale_to_fit_width(max_title_width)

        # Plain-language relationships
        line0 = Text(
            "force = mass * acceleration",
            font_size=38,
        )
        line1 = Text(
            "force = mass * angular_acceleration * radius",
            font_size=38,
        )
        line2 = Text(
            "torque = force × radius (perpendicular)",
            font_size=38,
        )

        # Math derivation steps
        eq1 = MathTex(
            r"F = m \alpha r",
            font_size=60,
        )
        eq2 = MathTex(
            r"F \cdot r = m \alpha r^2",
            font_size=60,
        )
        eq3 = MathTex(
            r"\tau = m \alpha r^2",
            font_size=60,
        )
        eq4 = MathTex(
            r"\alpha = \dfrac{\tau}{m r^2}",
            font_size=60,
        )

        # Moment of inertia summary
        line3 = Text(
            "sum of mass * radius² over particles = moment of inertia",
            font_size=34,
        )
        eqI = MathTex(
            r"I = \sum m r^2",
            font_size=64,
        )
        eqFinal = MathTex(
            r"\tau = I \alpha",
            font_size=64,
        )

        # Layout
        group_top = VGroup(title, line0, line1, line2).arrange(DOWN, buff=0.5)
        group_eqs = VGroup(eq1, eq2, eq3, eq4).arrange(DOWN, buff=0.5)
        group_bottom = VGroup(line3, eqI, eqFinal).arrange(DOWN, buff=0.5)

        all_groups = VGroup(group_top, group_eqs, group_bottom).arrange(DOWN, buff=0.6)
        max_total_height = config.frame_height * 0.9
        if all_groups.height > max_total_height:
            all_groups.scale_to_fit_height(max_total_height)
        all_groups.move_to(ORIGIN)

        # Animate
        self.play(FadeIn(title))
        self.wait(0.6)
        self.play(FadeIn(line0))
        self.wait(0.6)
        self.play(FadeIn(line1))
        self.wait(0.9)
        self.play(FadeIn(line2))
        self.wait(0.9)

        self.play(Write(eq1))
        self.wait(0.9)
        self.play(Write(eq2))
        self.wait(0.9)
        self.play(Write(eq3))
        self.wait(0.9)
        self.play(Write(eq4))
        self.wait(1.2)

        self.play(FadeIn(line3))
        self.wait(0.8)
        self.play(Write(eqI))
        self.wait(0.8)
        self.play(Write(eqFinal))
        self.wait(3.0)



