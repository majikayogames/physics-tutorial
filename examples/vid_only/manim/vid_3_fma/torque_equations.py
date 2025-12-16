from manim import *


class TorqueEquations(Scene):
    def construct(self):
        # Title
        title = Text(
            "Torque formulas:",
            font_size=48,
        )

        # Plain-language equations
        line1 = Text(
            "torque = r × force",
            font_size=42,
        )
        line2 = Text(
            "torque = moment of inertia * angular acceleration",
            font_size=42,
        )

        # Subtitle and symbolic forms
        formal_title = Text(
            "As equations:",
            font_size=36,
        )
        eq1 = MathTex(r"\tau = \mathbf{r} \times \mathbf{F}", font_size=64)
        eq2 = MathTex(r"\tau = I\,\alpha", font_size=64)
        math_group = VGroup(eq1, eq2).arrange(DOWN, buff=0.4)

        # Ensure none of the items exceed frame width
        max_width = config.frame_width * 0.9
        for mob in [title, line1, line2, formal_title, eq1, eq2]:
            if mob.width > max_width:
                mob.set(width=max_width)

        # Center everything as one vertical group
        group = VGroup(title, line1, line2, formal_title, math_group).arrange(DOWN, buff=0.6)
        group.move_to(ORIGIN)

        # Animate
        self.play(FadeIn(title))
        self.wait(0.6)
        self.play(FadeIn(line1))
        self.wait(0.6)
        self.play(FadeIn(line2))
        self.wait(1.0)
        self.play(FadeIn(formal_title))
        self.play(Write(eq1))
        self.play(Write(eq2))
        self.wait(5)


