from manim import *


class ForceFromAcceleration(Scene):
    def construct(self):
        # Title
        title = Text(
            "Force from acceleration:",
            font_size=48,
        )

        # Plain-language equation
        line1 = Text(
            "Force = mass * acceleration",
            font_size=42,
        )

        # Subtitle and symbolic form
        formal_title = Text(
            "As an equation:",
            font_size=36,
        )
        math_form = MathTex(
            r"F = m a",
            font_size=64,
        )

        # Center everything as one vertical group
        group = VGroup(title, line1, formal_title, math_form).arrange(DOWN, buff=0.6)
        group.move_to(ORIGIN)

        # Animate
        self.play(FadeIn(title))
        self.wait(0.6)
        self.play(FadeIn(line1))
        self.wait(1.2)
        self.play(FadeIn(formal_title))
        self.play(Write(math_form))
        self.wait(5)



