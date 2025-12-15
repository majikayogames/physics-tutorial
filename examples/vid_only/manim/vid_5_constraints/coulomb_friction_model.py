from manim import *


class CoulombFrictionModel(Scene):
    def construct(self):
        # Title
        title = Text(
            "Coulomb Friction Model",
            font_size=48,
        ).move_to(UP * 2.0)

        # The equation F_f <= mu * F_n
        equation = MathTex(
            r"F_f \le \mu F_n",
            font_size=72,
        )
        equation.move_to(ORIGIN)

        # Animate
        self.play(FadeIn(title))
        self.wait(0.6)
        self.play(Write(equation))
        self.wait(4)

