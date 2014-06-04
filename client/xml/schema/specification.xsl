<?xml version="1.0"?>
<xsl:transform xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  version="1.0" xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">

  <xsl:output method="html"/>

  <xsl:template match="xs:attribute" mode="attributes">
    <tr valign="baseline">
      <th align="left" rowspan="2" class="attribute_tbl">
        <xsl:value-of select="@name"/>
      </th>
      <td>

        <xsl:choose>
          <xsl:when test="xs:simpleType">
            <xsl:apply-templates select="xs:simpleType"/>
          </xsl:when>
          <xsl:when test="@type">
            <xsl:call-template name="simpleType">
              <xsl:with-param name="type" select="@type"/>
            </xsl:call-template>
          </xsl:when>

        </xsl:choose>
      </td>
      <td>
        <xsl:choose>
          <xsl:when test="@use">
            <xsl:value-of select="@use"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>optional</xsl:text>

          </xsl:otherwise>
        </xsl:choose>
	<xsl:if test="@default">
	  <xsl:text>; default: </xsl:text>
	  <code>
	    <xsl:value-of select="@default"/>
	  </code>
	</xsl:if>

      </td>
    </tr>
    <tr valign="baseline">
      <td colspan="2">
        <xsl:apply-templates select="xs:annotation"/>
      </td>
    </tr>
  </xsl:template>

  <xsl:template match="xs:attribute"/>

  <xsl:template match="xs:choice/xs:choice | xs:sequence/xs:choice">
    <li>
      <xsl:call-template name="occurrence"/>
      <xsl:text> choice of:</xsl:text>
      <ul>
        <xsl:apply-templates/>

      </ul>
    </li>
  </xsl:template>

  <xsl:template match="xs:choice">
    <p>
      <xsl:call-template name="occurrence"/>
      <xsl:text> choice of:</xsl:text>

    </p>
    <ul>
      <xsl:apply-templates/>
    </ul>
  </xsl:template>

  <xsl:template match="xs:complexType">
    <xsl:choose>
      <xsl:when test="xs:all">

        <p>All</p>
      </xsl:when>
      <xsl:when test="xs:choice | xs:complexContent | xs:group |
                      xs:sequence | xs:simpleContent">
        <xsl:if test="@mixed='true'">
          <p>Mixed content, including:</p>
        </xsl:if>
        <xsl:apply-templates/>
      </xsl:when>

      <xsl:when test="@mixed='true'">
        <p>Character content</p>
      </xsl:when>
      <xsl:otherwise>
        <p>Empty</p>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="xs:schema/xs:annotation/xs:documentation">
    <xsl:choose>
      <xsl:when test="count(.. |
                      ../../xs:annotation[xs:documentation][1]) = 1">
        <h1>
          <xsl:apply-templates/>
        </h1>
        <xsl:call-template name="toc"/>
      </xsl:when>

      <xsl:otherwise>
        <p>
          <xsl:apply-templates/>
        </p>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="xs:documentation">
<div class="sugar_tab" id="{parent::*/parent::*/@name[1]}">
      <xsl:apply-templates/>
 </div>
  </xsl:template>

  <xsl:template match="xs:element[@name]">
    <div class="sugar" id="element-type-{@name}">
      <xsl:text>ELEMENTTI: </xsl:text>
      <xsl:value-of select="@name"/>
	</div>
    <xsl:if test="/xs:schema/@targetNamespace">
      <p>
        <xsl:text>Namespace: </xsl:text>
        <code>
          <xsl:value-of select="/xs:schema/@targetNamespace"/>
        </code>
      </p>

    </xsl:if>
    <xsl:apply-templates select="xs:annotation"/>
    <xsl:if test="descendant::xs:attribute">
      <table border="1" id ="attr_{@name}">
        <caption>ATTRIBUUTIT</caption>
        <xsl:apply-templates select="xs:complexType/xs:attribute"
          mode="attributes"/>
      </table>
    </xsl:if>

    <h3>Content Model</h3>
    <xsl:choose>
      <xsl:when test="xs:complexType">
        <xsl:apply-templates select="xs:complexType"/>
      </xsl:when>
      <xsl:when test="xs:simpleType">
        <xsl:apply-templates select="xs:simpleType"/>
      </xsl:when>

      <xsl:when test="@type">
        <p>
          <xsl:call-template name="simpleType">
            <xsl:with-param name="type" select="@type"/>
          </xsl:call-template>
        </p>
      </xsl:when>
      <xsl:otherwise>
        <p>Empty</p>

      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template
    match="xs:choice/xs:element[@ref] | xs:sequence/xs:element[@ref]">
    <li>
      <xsl:call-template name="occurrence"/>
      <xsl:text> </xsl:text>
      <a href="#element-type-{@ref}">

        <xsl:value-of select="@ref"/>
      </a>
    </li>
  </xsl:template>

  <xsl:template match="xs:enumeration">
    <li>
      <code>
        <xsl:value-of select="@value"/>

      </code>
    </li>
  </xsl:template>

  <xsl:template match="xs:group[@name]">
    <h2 id="group-{@name}">
      <xsl:text>Content Model Group: </xsl:text>
      <xsl:value-of select="@name"/>
    </h2>

    <xsl:apply-templates select="xs:annotation"/>
    <xsl:if test="descendant::xs:attribute">
      <table border="1">
        <caption>ATTRIBUUTTIT</caption>
        <xsl:apply-templates select="descendant::xs:attribute"
          mode="attributes"/>
      </table>
    </xsl:if>
    <h3>Content Particle</h3>

    <xsl:apply-templates select="xs:choice | xs:complexContent |
                                 xs:group | xs:sequence |
                                 xs:simpleContent"/>
  </xsl:template>

  <xsl:template
    match="xs:choice/xs:group[@ref] | xs:sequence/xs:group[@ref]"
    priority="2">
    <li>
      <xsl:call-template name="occurrence"/>
      <xsl:text> </xsl:text>
      <a href="#group-{@ref}">
        <xsl:value-of select="@ref"/>

      </a>
      <xsl:text> group</xsl:text>
    </li>
  </xsl:template>

  <xsl:template match="xs:group[@ref]" priority="1">
    <ul>
      <li>

        <xsl:call-template name="occurrence"/>
        <xsl:text> </xsl:text>
        <a href="#group-{@ref}">
          <xsl:value-of select="@ref"/>
        </a>
        <xsl:text> group</xsl:text>
      </li>

    </ul>
  </xsl:template>

  <xsl:template match="xs:restriction">
    <p>
      <xsl:call-template name="simpleType">
        <xsl:with-param name="type" select="@base"/>
      </xsl:call-template>
    </p>

    <xsl:if test="xs:enumeration">
      <p>
        <xsl:text>Enumeration:</xsl:text>
      </p>
      <ul>
        <xsl:apply-templates select="xs:enumeration"/>
      </ul>
    </xsl:if>

  </xsl:template>

  <xsl:template match="xs:schema">
    <html>
      <head>
        <title>
          <xsl:value-of
            select="xs:annotation[xs:documentation][1]/
                    xs:documentation"/>
        </title>
		<link rel="stylesheet" type="text/css" href="http://yui.yahooapis.com/2.9.0/build/fonts/fonts-min.css" />
<link rel="stylesheet" type="text/css" href="http://yui.yahooapis.com/2.9.0/build/treeview/assets/skins/sam/treeview.css" />
<script type="text/javascript" src="http://yui.yahooapis.com/2.9.0/build/yahoo-dom-event/yahoo-dom-event.js"></script>
<script type="text/javascript" src="http://yui.yahooapis.com/2.9.0/build/treeview/treeview-min.js"></script>
        <style>

          
        
		body{padding: 0;
			background-image: linear-gradient(top, rgb(245,247,250) 0%, rgb(255,255,255) 100%);
background-image: -o-linear-gradient(top, rgb(245,247,250) 0%, rgb(255,255,255) 100%);
background-image: -moz-linear-gradient(top, rgb(245,247,250) 0%, rgb(255,255,255) 100%);
background-image: -webkit-linear-gradient(top, rgb(245,247,250) 0%, rgb(255,255,255) 100%);
background-image: -ms-linear-gradient(top, rgb(245,247,250) 0%, rgb(255,255,255) 100%);

background-image: -webkit-gradient(
	linear,
	left top,
	left bottom,
	color-stop(0, rgb(245,247,250)),
	color-stop(1, rgb(255,255,255))
);
			font-family:verdana,helvetica,sans-serif;
		}
		h1{ 
                 margin: 0;
                 padding-top: 1em; }
		h2{ border-top: black solid 1px;
                 margin-top: 2em;
                 padding-top: 1em; }
		.container { background: white;
                 margin: 0 50px 0 50px;
				 padding: 0;
				 border: 1px solid #fff;			 
				 }
		caption {
			border: 3px solid;
			border-color: #FFF;	
			font-size: 18px;
			font-weight: bold;
			background-image: linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);
			background-image: -o-linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);
			background-image: -moz-linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);
			background-image: -webkit-linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);
			background-image: -ms-linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);

			background-image: -webkit-gradient(
				linear,
				left bottom,
				right bottom,
				color-stop(0.87, rgb(253,148,83)),
				color-stop(1, rgb(255,255,255))
			);
			color: white;
			text-align: left;
		}

		.sugar{
			font-size: 18px;
			font-weight: bold;
			text-align: left;
			padding: 0px 5px 4px 5px;
			border-left: none;
			border-right: none;
			border-top: 1px solid #CCC;
			border-bottom: 1px solid #CCC;
			background-image: linear-gradient(left , rgb(235,235,237) 0%, rgb(255,255,255) 100%);
			background-image: -o-linear-gradient(left , rgb(235,235,237) 0%, rgb(255,255,255) 100%);
			background-image: -moz-linear-gradient(left , rgb(235,235,237) 0%, rgb(255,255,255) 100%);
			background-image: -webkit-linear-gradient(left , rgb(235,235,237) 0%, rgb(255,255,255) 100%);
			background-image: -ms-linear-gradient(left , rgb(235,235,237) 0%, rgb(255,255,255) 100%);

			background-image: -webkit-gradient(
				linear,
				left bottom,
				right bottom,
				color-stop(0, rgb(235,235,237)),
				color-stop(1, rgb(255,255,255))
			);
		}
		.sugar_tab{
			border-top: 2px solid;
			padding: 10px 5px 12px 5px;
			font-size: 16px;
			margin: 5px 0 5px 0;
			border-bottom-color: #ABC3D7;
			border-top-color: #4E8CCF;
			color: black;
			background-color: #F6F6F6;
		}
		.attribute_tbl{
			background-color:#FD9453;
			color: white;
		}
		.attributes_list{
			font-weight: 
			bold;background-color:#FD9453; 
			font-size: 16px; 
			color:#FFF;
			margin-top:5px;
			background-image: linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);
			background-image: -o-linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);
			background-image: -moz-linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);
			background-image: -webkit-linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);
			background-image: -ms-linear-gradient(left , rgb(253,148,83) 87%, rgb(255,255,255) 100%);

			background-image: -webkit-gradient(
				linear,
				left bottom,
				right bottom,
				color-stop(0.87, rgb(253,148,83)),
				color-stop(1, rgb(255,255,255))
			);
		}
		.attribute{font-size: 12px;margin:5px;}
		.attributes{
			color:#FF003C;
		}
		.elements{
			color:#1500FF;
		}
		.left{
			display:block;
			margin-left:25px;
		}
		#pre_DetailsView{
			width:34px;
			height:41px;
			margin-right:-2px;
			margin-top:25px;
			float:right;
			z-index:200;

		}
		#DetailsView{
			margin-right:20px;
			width:60%;
			min-height:90px;
			float:right;
			z-index:1;
			padding-left: 15px;
			padding-right: 15px;
			padding-bottom: 15px;
			border-left: 2px solid #59789F;
			border-top: 2px solid #59789F;
			border-right: 2px solid #59789F;
			border-bottom: 2px solid #59789F;
			border-radius: 20px;
		}
		#treeDiv1{
			width:30%;
			margin-left:20px;
			float:left;
			background-color: #FFF;
		}
        </style>
      </head>
      <body>
	  <div class="container">
	  <div class="sugar"><h1>XML-FORMAATIN SPESIFIKAATIO</h1>
	  <h3>XML-skeema: "http://meku.herokuapp.com/xml/schema/VETschema.xsd"</h3>
	  </div>
			<div class="sugar_tab">
				Valtion elokuvatarkastamon (VET) sähköinen kuvaohjelmien rekisteröintijärjestelmä (E-ILMO) valmistautuu vastaanottamaan seuraavanmuotoista XML-dataa. XML-tiedoston alkuun tulee XML:n versionumero sekä koodaustapa. Sen jälkeen tiedosto koostuu yhdestä ASIAKAS-elementistä sekä yhdestä tai useammasta KUVAOHJELMA-elementistä. Nämä kuvaohjelmat ovat joko ilmoitettavia tai tarkastutettavia kuvaohjelmia.

				<div>
					<span class="elements">&lt;?XML </span><span class="attributes">version</span>="1.0" <span class="attributes">encoding</span>="UTF-8" <span class="elements">?&gt;</span>
				</div>
				<div class="left">
					<span class="elements">&lt;ASIAKAS </span>
					<div  class="left">
						<span class="elements">&lt;KUVAOHJELMA </span><span class="attributes">TYPE</span>="01"&gt;...<span class="elements">&lt;/KUVAOHJELMA&gt;</span>
					</div>
					<div  class="left">
						<span class="elements">&lt;KUVAOHJELMA </span><span class="attributes">TYPE</span>="03"&gt;...<span class="elements">&lt;/KUVAOHJELMA&gt;</span>
					</div>
					<span class="elements">&lt;/ASIAKAS&gt;</span>
				</div>
				
			</div>
			

        <xsl:apply-templates/>
		
			<div class="sugar">ESIMERKKI</div>
			<div class="sugar_tab">
			<div class="left">
<span class="elements">&lt;?XML </span><span class="attributes">version</span>="1.0" <span class="attributes">encoding</span>="UTF-8" <span class="elements">?&gt;</span>
<div class="left"><span class="elements">&lt;ASIAKAS&gt;</span><br /><br />
	<div class="left">
	<span class="elements">&lt;KUVAOHJELMA <span class="attributes">TYPE</span>=&quot;01&quot;&gt;</span>
		<div class="left"><span class="elements">&lt;ALKUPERAINENNIMI&gt;</span>Uskomaton uusperhe<span class="elements">&lt;/ALKUPERAINENNIMI&gt;</span></div>
		<div class="left"><span class="elements">&lt;SUOMALAINENNIMI&gt;</span>Uskomaton uusperhe<span class="elements">&lt;/SUOMALAINENNIMI&gt;</span></div>
		<div class="left"><span class="elements">&lt;RUOTSALAINENNIMI&gt;</span>Uskomaton uusperhe<span class="elements">&lt;/RUOTSALAINENNIMI&gt;</span></div>
		<div class="left"><span class="elements">&lt;MUUNIMI&gt;</span>Uskomaton uusperhe<span class="elements">&lt;/MUUNIMI&gt;</span></div>
		<div class="left"><span class="elements">&lt;ASIAKKAANTUNNISTE&gt;</span>E0327962<span class="elements">&lt;/ASIAKKAANTUNNISTE&gt;</span></div>
		<div class="left"><span class="elements">&lt;ESITYSAIKA&gt;</span>11.11.2011 11:11:11<span class="elements">&lt;/ESITYSAIKA&gt;</span></div>
		<div class="left"><span class="elements">&lt;MAAT&gt;</span>US FI FR<span class="elements">&lt;/MAAT&gt;</span></div>
		<div class="left"><span class="elements">&lt;LAJIT&gt;</span>1a 1b<span class="elements">&lt;/LAJIT&gt;</span></div>
		<div class="left"><span class="elements">&lt;VALMISTUMISVUOSI&gt;</span>1996<span class="elements">&lt;/VALMISTUMISVUOSI&gt;</span></div>
		<div class="left"><span class="elements">&lt;JULKAISVUOSI&gt;</span>1997<span class="elements">&lt;/JULKAISVUOSI&gt;</span></div>
		<div class="left"><span class="elements">&lt;SYNOPSIS&gt;</span>Lomaromansseja 2/2. Romantiikkaa on ilmassa monellakin rintamalla, mutta siinä missä jotkut ovat innokkaampia ja tunteistaan varmoja, toiset arkailevat ja etenevät hitaammin. Kuullaanko pian hääkellojen kilinää?<span class="elements">&lt;/SYNOPSIS&gt;</span></div>
		<div class="left"><span class="elements">&lt;TUOTANTOYHTIO&gt;</span>TF1/Société Nationale de Télévision Francaise 1<span class="elements">&lt;/TUOTANTOYHTIO&gt;</span></div>
		<div class="left"><span class="elements">
		&lt;OHJAAJA&gt;</span>
			<div class="left"><span class="elements">&lt;SUKUNIMI&gt;</span>Silverman&lt;/SUKUNIMI&gt;</div>
			<div class="left"><span class="elements">&lt;ETUNIMI&gt;</span>David&lt;/ETUNIMI&gt;</div><span class="elements">
		&lt;/OHJAAJA&gt;</span>
		</div>
		<div class="left"><span class="elements">
		&lt;NAYTTELIJA&gt;</span>
			<div class="left"><span class="elements">&lt;SUKUNIMI&gt;</span>Simpson<span class="elements">&lt;/SUKUNIMI&gt;</span></div>
			<div class="left"><span class="elements">&lt;ETUNIMI&gt;</span>Bart<span class="elements">&lt;/ETUNIMI&gt;</span></div><span class="elements">
		&lt;/NAYTTELIJA&gt;</span>
		</div>
		<div class="left">
		<span class="elements">&lt;LUOKITTELU&gt;</span>
			<div class="left"><span class="elements">&lt;KESTO&gt;</span>23:00:00<span class="elements">&lt;/KESTO&gt;</span></div>
			<div class="left"><span class="elements">&lt;FORMAATTI&gt;</span>VoD<span class="elements">&lt;/FORMAATTI&gt;</span></div>
			<div class="left"><span class="elements">&lt;KOLMIULOTTEINENGRAFIIKKA /&gt;</span></div>
			<div class="left"><span class="elements">&lt;HUOMAUTUKSIA&gt;</span>FAMILLE FORMIDABLE (UNE),<span class="elements">&lt;/HUOMAUTUKSIA&gt;</span></div>
			<div class="left"><span class="elements">&lt;VALITTUTERMI <span class="attributes">KRITEERI</span>=&quot;6&quot; /&gt;</span></div>
			<div class="left"><span class="elements">&lt;VALITTUTERMI <span class="attributes">KRITEERI</span>=&quot;11&quot; /&gt;</span></div>
			<div class="left"><span class="elements">&lt;VALITTUTERMI <span class="attributes">KRITEERI</span>=&quot;23&quot; <span class="attributes">KOMMENTI</span>=&quot;comment1&quot; /&gt;</span></div>
			<div class="left"><span class="elements">&lt;LUOKITTELUNMAKSAJA&gt;</span>Tarjoaja<span class="elements">&lt;/LUOKITTELUNMAKSAJA&gt;</span></div>
		<span class="elements">&lt;/LUOKITTELU&gt;</span>
		</div>
		<div class="left"><span class="elements">&lt;LUOKITTELIJA&gt;</span>MEMAPI<span class="elements">&lt;/LUOKITTELIJA&gt;</span></div>
		<div class="left"><span class="elements">&lt;ISANTAOHJELMA&gt;</span>main tv series name<span class="elements">&lt;/ISANTAOHJELMA&gt;</span></div>
	<span class="elements">&lt;/KUVAOHJELMA&gt;</span>
	</div>
	<br />
	<div class="left">
	<span class="elements">&lt;KUVAOHJELMA <span class="attributes">TYPE</span>=&quot;02&quot;&gt;</span>
		<div class="left"><span class="elements">&lt;ALKUPERAINENNIMI&gt;</span>New movie<span class="elements">&lt;/ALKUPERAINENNIMI&gt;</span></div>
		<div class="left"><span class="elements">&lt;SUOMALAINENNIMI&gt;</span>Uusi elokuva<span class="elements">&lt;/SUOMALAINENNIMI&gt;</span></div>
		<div class="left"><span class="elements">&lt;MAAT&gt;</span>US FR<span class="elements">&lt;/MAAT&gt;</span></div>
		<div class="left"><span class="elements">&lt;LAJIT&gt;</span>1a 1b<span class="elements">&lt;/LAJIT&gt;</span></div>
		<div class="left"><span class="elements">&lt;VALMISTUMISVUOSI&gt;</span>2006<span class="elements">&lt;/VALMISTUMISVUOSI&gt;</span></div>
		<div class="left"><span class="elements">&lt;JULKAISVUOSI&gt;</span>2007<span class="elements">&lt;/JULKAISVUOSI&gt;</span></div>
		<div class="left"><span class="elements">&lt;SYNOPSIS&gt;</span>Some description<span class="elements">&lt;/SYNOPSIS&gt;</span></div>
		<div class="left"><span class="elements">&lt;TUOTANTOYHTIO&gt;</span>Columbia pictures<span class="elements">&lt;/TUOTANTOYHTIO&gt;</span></div>
		<div class="left">
		<span class="elements">&lt;LUOKITTELU&gt;</span>
			<div class="left"><span class="elements">&lt;KESTO&gt;</span>01:14:24<span class="elements">&lt;/KESTO&gt;</span></div>
			<div class="left"><span class="elements">&lt;FORMAATTI&gt;</span>DVD<span class="elements">&lt;/FORMAATTI&gt;</span></div>
			<div class="left"><span class="elements">&lt;VALITTUTERMI <span class="attributes">KRITEERI</span>=&quot;18&quot; <span class="attributes">KOMMENTI</span>=&quot;comment1&quot;/&gt;</span></div>
			<div class="left"><span class="elements">&lt;VALITTUTERMI <span class="attributes">KRITEERI</span>=&quot;21&quot; <span class="attributes">KOMMENTI</span>=&quot;comment2&quot;/&gt;</span></div>
			<div class="left"><span class="elements">&lt;LUOKITTELUNMAKSAJA&gt;</span>Tarjoaja<span class="elements">&lt;/LUOKITTELUNMAKSAJA&gt;</span></div>
		<span class="elements">&lt;/LUOKITTELU&gt;</span>
		</div>
	<span class="elements">&lt;/KUVAOHJELMA&gt;</span>
	</div>
	<br />
	<div class="left">
	<span class="elements">&lt;KUVAOHJELMA <span class="attributes">TYPE</span>=&quot;03&quot;&gt;</span>
		<div class="left"><span class="elements">&lt;ALKUPERAINENNIMI&gt;</span>Kotimainen fiktio<span class="elements">&lt;/ALKUPERAINENNIMI&gt;</span></div>
		<div class="left"><span class="elements">&lt;SUOMALAINENNIMI&gt;</span>Kotimainen fiktio elokuva<span class="elements">&lt;/SUOMALAINENNIMI&gt;</span></div>
		<div class="left"><span class="elements">&lt;MAAT&gt;</span>FI<span class="elements">&lt;/MAAT&gt;</span></div>
		<div class="left"><span class="elements">&lt;TELEVISIO-OHJELMALAJIT&gt;</span>5 7.1<span class="elements">&lt;/TELEVISIO-OHJELMALAJIT&gt;</span></div>
		<div class="left"><span class="elements">&lt;VALMISTUMISVUOSI&gt;</span>2010<span class="elements">&lt;/VALMISTUMISVUOSI&gt;</span></div>
		<div class="left"><span class="elements">&lt;JULKAISVUOSI&gt;</span>2013<span class="elements">&lt;/JULKAISVUOSI&gt;</span></div>
		<div class="left"><span class="elements">&lt;SYNOPSIS&gt;</span>Some description<span class="elements">&lt;/SYNOPSIS&gt;</span></div>
		<div class="left"><span class="elements">&lt;TUOTANTOYHTIO&gt;</span>Columbia picture<span class="elements">s&lt;/TUOTANTOYHTIO&gt;</span></div>
		<div class="left">
		<span class="elements">&lt;LUOKITTELU&gt;</span>
		<div class="left"><span class="elements">&lt;KESTO&gt;</span>00:34:24<span class="elements">&lt;/KESTO&gt;</span></div>
			<div class="left"><span class="elements">&lt;FORMAATTI&gt;</span>VoD<span class="elements">&lt;/FORMAATTI&gt;</span></div>
			<div class="left"><span class="elements">&lt;VALITTUTERMI <span class="attributes">KRITEERI</span>=&quot;6&quot; /&gt;</span></div>
			<div class="left"><span class="elements">&lt;VALITTUTERMI <span class="attributes">KRITEERI</span>=&quot;7&quot; <span class="attributes">KOMMENTI</span>=&quot;comment&quot;/&gt;</span></div>
			<div class="left"><span class="elements">&lt;LUOKITTELUNMAKSAJA&gt;</span>Tarjoaja<span class="elements">&lt;/LUOKITTELUNMAKSAJA&gt;</span></div>
		<span class="elements">&lt;/LUOKITTELU&gt;</span>
		</div>
	<span class="elements">&lt;/KUVAOHJELMA&gt;</span>
	</div>
	<br />
	<br />
<span class="elements">&lt;/ASIAKAS&gt;</span>
</div>
</div>
			
			</div>      
			</div>
			</body>
    </html>
  </xsl:template>

  <xsl:template
    match="xs:choice/xs:sequence | xs:sequence/xs:sequence">

    <li>
      <xsl:call-template name="occurrence"/>
      <xsl:text> sequences of:</xsl:text>
      <ol>
        <xsl:apply-templates/>
      </ol>
    </li>
  </xsl:template>

  <xsl:template match="xs:sequence">
    <p>
      <xsl:call-template name="occurrence"/>
      <xsl:text> sequences of:</xsl:text>
    </p>
    <ol>
      <xsl:apply-templates/>

    </ol>
  </xsl:template>

  <xsl:template name="occurrence">
    <xsl:variable name="minOccurs">
      <xsl:choose>
        <xsl:when test="@minOccurs">
          <xsl:value-of select="@minOccurs"/>
        </xsl:when>

        <xsl:otherwise>
          <xsl:value-of select="1"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="maxOccurs">
      <xsl:choose>
        <xsl:when test="@maxOccurs">
          <xsl:value-of select="@maxOccurs"/>

        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="1"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$minOccurs = $maxOccurs">
        <xsl:text>Exactly </xsl:text>

        <xsl:value-of select="$minOccurs"/>
      </xsl:when>
      <xsl:when test="$minOccurs = 0 and $maxOccurs = 'unbounded'">
        <xsl:text>Optional repeatable</xsl:text>
      </xsl:when>
      <xsl:when test="$maxOccurs = 'unbounded'">
        <xsl:value-of select="$minOccurs"/>
        <xsl:text> or more</xsl:text>

      </xsl:when>
      <xsl:when test="$minOccurs = 0 and $maxOccurs = 1">
        <xsl:text>An optional</xsl:text>
      </xsl:when>
      <xsl:when test="$minOccurs = 0">
        <xsl:text>Up to </xsl:text>
        <xsl:value-of select="$maxOccurs"/>
      </xsl:when>

      <xsl:otherwise>
        <xsl:text>Between </xsl:text>
        <xsl:value-of select="$minOccurs"/>
        <xsl:text> and </xsl:text>
        <xsl:value-of select="$maxOccurs"/>
      </xsl:otherwise>
    </xsl:choose>

  </xsl:template>

  <xsl:template name="simpleType">
    <xsl:param name="type"/>
    <xsl:choose>
      <xsl:when test="starts-with($type, 'xs:')">
        <xsl:text>Built-in type </xsl:text>
        <xsl:value-of
                      select="substring-after($type, ':')"/>
      </xsl:when>

      <xsl:otherwise>
        <xsl:text>Simple type </xsl:text>
        <a href="#simple-type-{$type}">
          <xsl:value-of select="$type"/>
        </a>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="toc">
    <h2>Sisällysluettelo</h2>
	 <div>
	<div id="treeDiv1"></div><div id="DetailsView"></div><div id="pre_DetailsView"></div>
	<div style="clear:both;"></div>
	</div>
    <xsl:if test="/xs:schema/xs:element">
	  <script type="text/javascript">

			</script>
      <ul id="treeOfElements" style="display:none;">
        <xsl:for-each select="/xs:schema//xs:element">
          <xsl:sort select="@name"/>

          <li>
            <a href="#element-type-{@name}">
              <xsl:value-of select="@name"/>
            </a>
          </li>
        </xsl:for-each>
      </ul>
	  <script type="text/javascript">
		  (function() {
	var tree;
	tree = new YAHOO.widget.TreeView("treeDiv1");	
	var rootNode = tree.getRoot();	
	
  function treeInit() {
		var treeOfElements=document.getElementById('treeOfElements').getElementsByTagName('a'); 

			 var tmpNode = new YAHOO.widget.TextNode('ASIAKAS', tree.getRoot(), true); 
			 
			 var tmpNode2 = new YAHOO.widget.TextNode('KUVAOHJELMA', tmpNode, true); 
			 
			 var tmpNode21 = new YAHOO.widget.TextNode('ALKUPERAINENNIMI', tmpNode2, true);
			 var tmpNode22 = new YAHOO.widget.TextNode('SUOMALAINENNIMI', tmpNode2, true);
			 var tmpNode23 = new YAHOO.widget.TextNode('RUOTSALAINENNIMI', tmpNode2, true);
			 var tmpNode24 = new YAHOO.widget.TextNode('MUUNIMI', tmpNode2, true);
			 var tmpNode24a = new YAHOO.widget.TextNode('TUOTANTOKAUSI', tmpNode2, true);
			 var tmpNode24b = new YAHOO.widget.TextNode('OSA', tmpNode2, true);
			 var tmpNode25 = new YAHOO.widget.TextNode('ASIAKKAANTUNNISTE', tmpNode2, true);
			 var tmpNode26 = new YAHOO.widget.TextNode('ESITYSAIKA', tmpNode2, true);
			 var tmpNode27 = new YAHOO.widget.TextNode('MAAT', tmpNode2, true);
			 var tmpNode28 = new YAHOO.widget.TextNode('TELEVISIO-OHJELMALAJIT', tmpNode2, true);
			 var tmpNode29 = new YAHOO.widget.TextNode('LAJIT', tmpNode2, true);
			 var tmpNode210 = new YAHOO.widget.TextNode('PELINLAJIT', tmpNode2, true);
			 var tmpNode211 = new YAHOO.widget.TextNode('VALMISTUMISVUOSI', tmpNode2, true);
			 var tmpNode212 = new YAHOO.widget.TextNode('JULKAISUVUOSI', tmpNode2, true);
			 var tmpNode213 = new YAHOO.widget.TextNode('SYNOPSIS', tmpNode2, true);
			 var tmpNode214 = new YAHOO.widget.TextNode('TUOTANTOYHTIO', tmpNode2, true);
			 
			 var tmpNode215 = new YAHOO.widget.TextNode('OHJAAJA', tmpNode2, true); 
			 var tmpNode2151 = new YAHOO.widget.TextNode('SUKUNIMI', tmpNode215, true); 
			 var tmpNode2152 = new YAHOO.widget.TextNode('ETUNIMI', tmpNode215, true); 
			 
			 var tmpNode216 = new YAHOO.widget.TextNode('NAYTTELIJA', tmpNode2, true); 
			 var tmpNode2161 = new YAHOO.widget.TextNode('SUKUNIMI', tmpNode216, true); 
			 var tmpNode2162 = new YAHOO.widget.TextNode('ETUNIMI', tmpNode216, true); 
			 
			 var tmpNode217 = new YAHOO.widget.TextNode('LUOKITTELU', tmpNode2, true); 
			 var tmpNode2171 = new YAHOO.widget.TextNode('KESTO', tmpNode217, true); 
			 var tmpNode2172 = new YAHOO.widget.TextNode('FORMAATTI', tmpNode217, true); 
			 var tmpNode2173 = new YAHOO.widget.TextNode('PELIFORMAATTI', tmpNode217, true); 
			 var tmpNode2174 = new YAHOO.widget.TextNode('KOLMIULOTTEINENGRAFIIKKA', tmpNode217, true); 
			 var tmpNode2175 = new YAHOO.widget.TextNode('HUOMAUTUKSIA', tmpNode217, true); 
			 var tmpNode2176 = new YAHOO.widget.TextNode('VALITTUTERMI', tmpNode217, true); 
			 var tmpNode2177 = new YAHOO.widget.TextNode('LUOKITTELUNMAKSAJA', tmpNode217, true); 
			 
			 var tmpNode218 = new YAHOO.widget.TextNode('LUOKITTELIJA', tmpNode2, true);
			 var tmpNode219 = new YAHOO.widget.TextNode('ISANTAOHJELMA', tmpNode2, true);

       tree.subscribe("expand", function(node) {
              YAHOO.log(node.index + " was expanded", "info", "example");
           });

       tree.subscribe("collapse", function(node) {
              YAHOO.log(node.index + " was collapsed", "info", "example");
           });

       tree.subscribe("labelClick", function(node) {
			ShowDetails(node.label);
           });
		tree.subscribe("dblClickEvent", function(node) {
           });
		
        tree.draw();
	}
	function ShowDetails(id){
		var dv = document.getElementById('DetailsView');
		if ( dv.hasChildNodes() ){
			while ( dv.childNodes.length >= 1 ){
				dv.removeChild( dv.firstChild );       
			} 
		}   
			var el = document.getElementById('element-type-'+id);
			
			
			var elDescription = document.getElementById(id);
			var header1=document.createElement("div");
			header1.innerHTML = '<h3 class="sugar">Elementti</h3>'+id;
			dv.appendChild(header1);
			if(document.getElementById('attr_'+id))var attr = document.getElementById('attr_'+id).getElementsByTagName("th");
			if(attr){
				var attributes=document.createElement("div");
				attributes.innerHTML = '<h3 class="sugar">Attribuutit:</h3>';

				if(attr[0]){	
					attributes.innerHTML = attributes.innerHTML + '<li class="attributes_list">' +attr[0].innerHTML+'</li>';
					var attrOfAttribute = document.getElementById(attr[0].innerHTML);
					if(attrOfAttribute) attributes.innerHTML = attributes.innerHTML + '<span class="attribute"><b>Kuvaus: </b>'+attrOfAttribute.innerHTML+ '</span>';
				}
				if(attr[1]){	
					attributes.innerHTML = attributes.innerHTML + '<li class="attributes_list">' +attr[1].innerHTML+ '</li>';
					var attrOfAttribute = document.getElementById(attr[1].innerHTML);
					if(attrOfAttribute) attributes.innerHTML = attributes.innerHTML + '<span class="attribute"><b>Kuvaus: </b>'+attrOfAttribute.innerHTML+ '</span>';
				}
				if(attr[2]){	
					attributes.innerHTML = attributes.innerHTML + '<li class="attributes_list">' +attr[2].innerHTML+ '</li>';
					var attrOfAttribute = document.getElementById(attr[3].innerHTML);
					if(attrOfAttribute) attributes.innerHTML = attributes.innerHTML + '<span class="attribute"><b>Kuvaus: </b>'+attrOfAttribute.innerHTML+ '</span>';
				}
				if(attr[3]){	
					attributes.innerHTML = attributes.innerHTML + '<li class="attributes_list">' +attr[3].innerHTML+ '</li>';
					var attrOfAttribute = document.getElementById(attr[4].innerHTML);
					if(attrOfAttribute) attributes.innerHTML = attributes.innerHTML + '<span class="attribute"><b>Kuvaus: </b>'+attrOfAttribute.innerHTML+ '</span>';
				}
				dv.appendChild(attributes);
			}
			
			var description=document.createElement("div");
			description.innerHTML = '<h3 class="sugar">Kuvaus:</h3>'+elDescription.innerHTML;
			dv.appendChild(description);
	}
    YAHOO.util.Event.onDOMReady(treeInit);

    
})();
		  </script>
    </xsl:if>
    <xsl:if test="/xs:schema/xs:group">

      <h3>Content Model Groups</h3>
      <ul>
        <xsl:for-each select="/xs:schema/xs:group">
          <xsl:sort select="@name"/>
          <li>
            <a href="#group-{@name}">
              <xsl:value-of select="@name"/>
            </a>

          </li>
        </xsl:for-each>
      </ul>
	  	  
    </xsl:if>
  </xsl:template>

</xsl:transform>
