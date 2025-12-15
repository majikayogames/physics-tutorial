from manim import *


class MomentumDefinition(Scene):
    def construct(self):
        # Title
        title = Text(
            "Momentum formula:",
            font_size=48,
        )

        # Plain-language equation
        line1 = Text(
            "momentum = mass * velocity",
            font_size=42,
        )

        # Prepare subtitle and symbolic form
        formal_title = Text(
            "As an equation:",
            font_size=36,
        )
        math_form = MathTex(
            r"p = m v",
            font_size=64,
        )

        # Arrange everything as one centered vertical group (v-centered and h-centered)
        group = VGroup(title, line1, formal_title, math_form).arrange(DOWN, buff=0.6)
        group.move_to(ORIGIN)

        # Animate title then the plain equation
        self.play(FadeIn(title))
        self.wait(0.6)
        self.play(FadeIn(line1))
        self.wait(1.2)

        # Keep the text visible; add the formal subtitle and equation below
        self.play(FadeIn(formal_title))
        self.play(Write(math_form))
        self.wait(5)


