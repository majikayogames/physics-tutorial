from manim import *


class CdotDerivation(Scene):
    def construct(self):
        # Title
        title = Text(
            "Relative velocity change (Cdot)",
            font_size=48,
        ).move_to(UP * 3.0)

        # Equations, laid out top to bottom and centered
        eqs = VGroup(
            MathTex(
                r"\Delta \mathrm{Cdot} = \Delta \mathrm{vel}_B - \Delta \mathrm{vel}_A",
                font_size=48,
            ),
            MathTex(
                r"\Delta \mathrm{Cdot}.x = \Delta \mathrm{vel}_B.x - \Delta \mathrm{vel}_A.x",
                font_size=48,
            ),
            MathTex(
                r"= Jx * (mB + iB * rB.y^{2}) - Jy * (iB * rB.x * rB.y)"
                r"\\- Jx * (mA + iA * rA.y^{2}) + Jy * (iA * rA.x * rA.y)",
                font_size=48,
            ),
        ).arrange(DOWN, buff=0.6)

        eqs.move_to(ORIGIN)

        # Animate: fade in line by line
        self.play(FadeIn(title))
        self.wait(0.6)

        for eq in eqs:
            self.play(FadeIn(eq))
            self.wait(0.6)

        self.wait(1.0)

        # Fade out the top two Cdot lines
        self.play(FadeOut(eqs[0]), FadeOut(eqs[1]))
        self.wait(0.3)

        # Slide the Jx/Jy equation (two-line MathTex) up into their place
        target_y = 0.5 * (eqs[0].get_center()[1] + eqs[1].get_center()[1])
        shift_up = target_y - eqs[2].get_center()[1]
        self.play(eqs[2].animate.shift(UP * shift_up))
        self.wait(0.4)

        # Put the ΔCdot.x label above the moved equation
        cdot_label = MathTex(
            r"\Delta \mathrm{Cdot}.x",
            font_size=36,
        )
        cdot_label.next_to(eqs[2], UP, buff=0.4)
        self.play(FadeIn(cdot_label))
        self.wait(0.4)

        # Fade in separated Jx and Jy grouped lines underneath
        grouped_lines = VGroup(
            MathTex(
                r"= Jx * (mB + iB * rB.y^{2}) - Jx * (mA + iA * rA.y^{2})",
                font_size=48,
            ),
            MathTex(
                r"- Jy * (iB * rB.x * rB.y) + Jy * (iA * rA.x * rA.y)",
                font_size=48,
            ),
        ).arrange(DOWN, buff=0.4)

        grouped_lines.next_to(eqs[2], DOWN, buff=0.5)

        for line in grouped_lines:
            self.play(FadeIn(line))
            self.wait(0.4)

        self.wait(0.8)

        # Fade in final combined Jx/Jy factored form underneath
        final_lines = VGroup(
            MathTex(
                r"= Jx * (mA + mB + iA * rA.y^{2} + iB * rB.y^{2})",
                font_size=48,
            ),
            MathTex(
                r"- Jy * (iA * rA.x * rA.y + iB * rB.x * rB.y)",
                font_size=48,
            ),
        ).arrange(DOWN, buff=0.4)

        final_lines.next_to(grouped_lines, DOWN, buff=0.5)

        for line in final_lines:
            self.play(FadeIn(line))
            self.wait(0.4)
        self.wait(0.8)

        # Fade out the first five lines (cdot label + four Jx/Jy equations)
        self.play(
            FadeOut(cdot_label),
            FadeOut(eqs[2]),
            FadeOut(grouped_lines),
        )
        self.wait(0.3)

        # Slide the final two lines up into (slightly above) their place
        original_block = VGroup(eqs[2], grouped_lines)
        target_y = original_block.get_center()[1] + 0.4
        shift_up = target_y - final_lines.get_center()[1]
        self.play(final_lines.animate.shift(UP * shift_up))
        self.wait(0.4)

        # Fade in a smaller ΔCdot.x label to the left of the final equation
        final_cdot_label = MathTex(
            r"\Delta \mathrm{Cdot}.x",
            font_size=36,
        )
        final_cdot_label.next_to(final_lines[0], LEFT, buff=0.4)
        self.play(FadeIn(final_cdot_label))
        self.wait(0.8)

        # Fade in matching two-line expression for ΔCdot.y below, aligned like the x-expression
        cdot_y_lines = VGroup(
            MathTex(
                r"= Jx * (-rA.x * rA.y * iA - rB.x * rB.y * iB)",
                font_size=48,
            ),
            MathTex(
                r"+ Jy * (mA + mB + rA.x^{2} * iA + rB.x^{2} * iB)",
                font_size=48,
            ),
        ).arrange(DOWN, buff=0.4)

        # Position the Y lines directly under the X lines, left-aligned
        cdot_y_lines.next_to(final_lines, DOWN, buff=0.5)
        cdot_y_lines.align_to(final_lines, LEFT)

        cdot_y_label = MathTex(
            r"\Delta \mathrm{Cdot}.y",
            font_size=36,
        )
        cdot_y_label.next_to(cdot_y_lines[0], LEFT, buff=0.4)

        cdot_y_group = VGroup(cdot_y_label, cdot_y_lines)

        # Fade ΔCdot.y label and its two lines in at once
        self.play(FadeIn(cdot_y_group))
        self.wait(0.8)

        self.wait(2.0)


