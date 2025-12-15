from manim import *


class VelAVelBDerivation(Scene):
    def construct(self):
        # Title
        title = Text(
            "Velocity change at constraint points",
            font_size=48,
        ).move_to(UP * 3.0)

        # Group 1: Direct translation of the code
        subtitle1 = Text(
            "Direct translation of the code:",
            font_size=36,
        )
        eqs1 = VGroup(
            MathTex(r"\Delta v_A = -\, m_A \,\mathbf{J}", font_size=48),
            MathTex(r"\Delta \omega_A = -\, i_A \,\bigl(\mathbf{r}_A \times \mathbf{J}\bigr)", font_size=48),
            MathTex(r"\Delta v_B = \;\;\, m_B \,\mathbf{J}", font_size=48),
            MathTex(r"\Delta \omega_B = \;\;\, i_B \,\bigl(\mathbf{r}_B \times \mathbf{J}\bigr)", font_size=48),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4)

        group1 = VGroup(subtitle1, eqs1).arrange(DOWN, buff=0.6)
        group1.move_to(ORIGIN)

        # Group 2: Combine linear and rotational contributions
        subtitle2 = Text(
            "Add linear and rotational velocity contributions:",
            font_size=36,
        )
        eqs2 = VGroup(
            MathTex(r"\Delta \mathrm{vel}_A = \Delta v_A \;+\; \Delta \omega_A \times \mathbf{r}_A", font_size=48),
            MathTex(r"\Delta \mathrm{vel}_B = \Delta v_B \;+\; \Delta \omega_B \times \mathbf{r}_B", font_size=48),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4)

        group2 = VGroup(subtitle2, eqs2).arrange(DOWN, buff=0.6)
        group2.move_to(ORIGIN)

        # Group 3: Substitute previous expressions
        subtitle3 = Text(
            "Substitute the expressions:",
            font_size=36,
        )
        eqs3 = VGroup(
            MathTex(
                r"\Delta \mathrm{vel}_A"
                r" = -\, m_A \,\mathbf{J} \;-\; \Bigl(i_A \,\bigl(\mathbf{r}_A \times \mathbf{J}\bigr)\Bigr) \times \mathbf{r}_A",
                font_size=48,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_B"
                r" = \;\;\, m_B \,\mathbf{J} \;+\; \Bigl(i_B \,\bigl(\mathbf{r}_B \times \mathbf{J}\bigr)\Bigr) \times \mathbf{r}_B",
                font_size=48,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4)

        group3 = VGroup(subtitle3, eqs3).arrange(DOWN, buff=0.6)
        group3.move_to(ORIGIN)

        # Group 4: Expand the first cross product
        subtitle4 = Text(
            "Expand the first cross product:",
            font_size=36,
        )
        eqs4 = VGroup(
            MathTex(
                r"\Delta \mathrm{vel}_A = -mA * J \;-\; iA * \bigl(rA.x * Jy - rA.y * Jx\bigr) \times rA",
                font_size=48,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_B = \;\;\, mB * J \;+\; iB * \bigl(rB.x * Jy - rB.y * Jx\bigr) \times rB",
                font_size=48,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4)

        group4 = VGroup(subtitle4, eqs4).arrange(DOWN, buff=0.6)
        group4.move_to(ORIGIN)

        # Group 5: 2D scalar cross and component form
        subtitle5 = Text(
            "2D scalar cross and component form:",
            font_size=36,
        )
        identity5 = MathTex(
            r"s \times [x, y] = [-\, s * y,\; s * x]",
            font_size=40,
        )
        eqs5 = VGroup(
            MathTex(
                r"\Delta \mathrm{vel}_A.x = -mA * Jx \;-\; iA * -rA.y * \bigl(rA.x * Jy - rA.y * Jx\bigr)",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_A.y = -mA * Jy \;-\; iA * rA.x * \bigl(rA.x * Jy - rA.y * Jx\bigr)",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_B.x = \;\;\, mB * Jx \;+\; iB * -rB.y * \bigl(rB.x * Jy - rB.y * Jx\bigr)",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_B.y = \;\;\, mB * Jy \;+\; iB * rB.x * \bigl(rB.x * Jy - rB.y * Jx\bigr)",
                font_size=44,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.35)

        group5 = VGroup(subtitle5, identity5, eqs5).arrange(DOWN, buff=0.6)
        group5.move_to(ORIGIN)

        # Animate
        self.play(FadeIn(title))
        self.wait(0.6)

        # Show group 1
        self.play(FadeIn(subtitle1))
        for eq in eqs1:
            self.play(Write(eq))
            self.wait(0.3)
        self.wait(1.2)
        self.play(FadeOut(group1))

        # Show group 2
        self.play(FadeIn(subtitle2))
        for eq in eqs2:
            self.play(Write(eq))
            self.wait(0.3)
        self.wait(1.2)
        self.play(FadeOut(group2))

        # Show group 3
        self.play(FadeIn(subtitle3))
        for eq in eqs3:
            self.play(Write(eq))
            self.wait(0.3)
        self.wait(1.2)
        self.play(FadeOut(group3))

        # Show group 4
        self.play(FadeIn(subtitle4))
        for eq in eqs4:
            self.play(Write(eq))
            self.wait(0.3)
        self.wait(1.2)
        self.play(FadeOut(group4))

        # Show group 5
        self.play(FadeIn(subtitle5))
        self.play(Write(identity5))
        self.wait(0.4)
        for eq in eqs5:
            self.play(Write(eq))
            self.wait(0.3)
        self.wait(1.2)
        self.play(FadeOut(group5))

        # Group 6: Multiply out the terms
        subtitle6 = Text(
            "Multiplying out the terms:",
            font_size=36,
        )
        eqs6 = VGroup(
            MathTex(
                r"\Delta \mathrm{vel}_A.x = -mA * Jx + iA * rA.x * rA.y * Jy - iA * rA.y * rA.y * Jx",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_A.y = -mA * Jy - iA * rA.x^{2} * Jy + iA * rA.x * rA.y * Jx",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_B.x = \;\;\, mB * Jx - iB * rB.x * rB.y * Jy + iB * rB.y^{2} * Jx",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_B.y = \;\;\, mB * Jy + iB * rB.x^{2} * Jy - iB * rB.x * rB.y * Jx",
                font_size=44,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.35)

        group6 = VGroup(subtitle6, eqs6).arrange(DOWN, buff=0.6)
        group6.move_to(ORIGIN)

        # Show group 6
        self.play(FadeIn(subtitle6))
        for eq in eqs6:
            self.play(Write(eq))
            self.wait(0.3)
        self.wait(1.2)
        self.play(FadeOut(group6))

        # Group 7: Group and factor Jx and Jy
        subtitle7 = Text(
            "Group and factor Jx and Jy:",
            font_size=36,
        )
        eqs7 = VGroup(
            MathTex(
                r"\Delta \mathrm{vel}_A.x = -Jx * (mA + iA * rA.y^{2}) + Jy * (iA * rA.x * rA.y)",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_A.y = -Jy * (mA + iA * rA.x^{2}) + Jx * (iA * rA.x * rA.y)",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_B.x = \;\;\, Jx * (mB + iB * rB.y^{2}) - Jy * (iB * rB.x * rB.y)",
                font_size=44,
            ),
            MathTex(
                r"\Delta \mathrm{vel}_B.y = \;\;\, Jy * (mB + iB * rB.x^{2}) - Jx * (iB * rB.x * rB.y)",
                font_size=44,
            ),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.35)

        group7 = VGroup(subtitle7, eqs7).arrange(DOWN, buff=0.6)
        group7.move_to(ORIGIN)

        # Show group 7
        self.play(FadeIn(subtitle7))
        for eq in eqs7:
            self.play(Write(eq))
            self.wait(0.3)
        self.wait(5)


